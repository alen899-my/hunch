const repo = require('./thoughts.repository');
const peopleService = require('../people/people.service');
const {
  isSafeExternalUrl,
  extractRawMediaKey,
  signAttachmentThoughtContent,
} = require('../../middlewares/security.middleware');

const getTodayDate = () => new Date().toISOString().split('T')[0];

const VALID_MOODS = new Set([
  'happy',
  'sad',
  'calm',
  'anxious',
  'grateful',
  'excited',
  'loved',
  'tired',
  'angry',
]);

const VALID_CATEGORIES = new Set(['thinking', 'image', 'video', 'audio']);

const extractSearchableText = (content) => {
  if (!content || typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type === 'attachment') {
        return typeof parsed.caption === 'string' ? parsed.caption : '';
      }
    } catch {
      // plain text
    }
  }
  return content;
};

/**
 * Validate attachment content before persisting so a user cannot embed
 * another user's private /api/upload/raw/ file or an unsafe scheme.
 */
const sanitizeThoughtContentForStorage = (userId, content) => {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const isAttachmentPayload =
          parsed.type === 'attachment' ||
          parsed.__attachment === true ||
          typeof parsed.key === 'string' ||
          (typeof parsed.publicUrl === 'string' && parsed.publicUrl.includes('/api/upload/raw/'));

        if (isAttachmentPayload) {
          if (parsed.key !== undefined && parsed.key !== null) {
            const keyStr = String(parsed.key);
            if (keyStr.includes('..') || keyStr.includes('\\') || !keyStr.startsWith(`uploads/${userId}/`)) {
              throw { status: 403, message: 'Forbidden attachment key' };
            }
          }
          if (parsed.publicUrl !== undefined && parsed.publicUrl !== null) {
            if (!isSafeExternalUrl(parsed.publicUrl)) {
              throw { status: 400, message: 'Invalid attachment URL' };
            }
            const cleanUrl = String(parsed.publicUrl).split('?')[0];
            if (cleanUrl.includes('/api/upload/raw/')) {
              const rawKey = extractRawMediaKey(cleanUrl);
              if (
                !rawKey ||
                rawKey.includes('..') ||
                rawKey.includes('\\') ||
                !rawKey.startsWith(`uploads/${userId}/`)
              ) {
                throw { status: 403, message: 'Forbidden attachment resource' };
              }
            }
            parsed.publicUrl = cleanUrl;
          }
          return JSON.stringify(parsed);
        }
      }
    } catch (err) {
      if (err?.status) throw err;
    }
  }
  return trimmed;
};

/**
 * Sign any /api/upload/raw/ URL inside serialized attachment content on read.
 */
const decorateThoughtMedia = (thought) => {
  if (!thought || typeof thought.content !== 'string') return thought;
  const signed = signAttachmentThoughtContent(thought.user_id, thought.content);
  return signed === thought.content ? thought : { ...thought, content: signed };
};

const extractTags = (content) => {
  const text = extractSearchableText(content);
  if (!text || !text.includes('#')) return [];
  const tags = new Set();
  const regex = /(?:^|[\s(\[{"'])#([a-zA-Z0-9_]{1,40})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
};

const getDays = async (userId) => repo.getDaysSummary(userId);

const getDayStream = async (userId, dayDate) => {
  const date = dayDate || getTodayDate();
  const [thoughts, mentionedPeople] = await Promise.all([
    repo.getThoughtsForDay(userId, date),
    peopleService.getMentionedPeopleForDay(userId, date),
  ]);
  return {
    dayDate: date,
    thoughts: thoughts.map(decorateThoughtMedia),
    mentionedPeople,
  };
};

const addThought = async (
  userId,
  { dayDate, content, category, mood, replyToId, mentionedPersonIds }
) => {
  const date = dayDate || getTodayDate();
  const validCategory = VALID_CATEGORIES.has(category) ? category : 'thinking';
  const validMood = mood && VALID_MOODS.has(String(mood).toLowerCase())
    ? String(mood).toLowerCase()
    : null;
  const sanitizedContent = sanitizeThoughtContentForStorage(userId, content);
  const tags = extractTags(sanitizedContent);

  const thought = await repo.createThought({
    userId,
    dayDate: date,
    content: sanitizedContent,
    category: validCategory,
    mood: validMood,
    tags,
    replyToId: replyToId || null,
  });

  const linkedPersonIds = await peopleService.linkThoughtMentions(
    userId,
    thought.id,
    thought.content,
    mentionedPersonIds
  );

  return {
    ...decorateThoughtMedia(thought),
    mentioned_person_ids: linkedPersonIds,
  };
};

const editThought = async (userId, id, { content, mood, isStarred, mentionedPersonIds }) => {
  const fields = {};

  if (typeof content === 'string' && content.trim().length > 0) {
    const sanitizedContent = sanitizeThoughtContentForStorage(userId, content);
    fields.content = sanitizedContent;
    fields.tags = extractTags(sanitizedContent);
  }

  if (mood !== undefined) {
    fields.mood = mood && VALID_MOODS.has(String(mood).toLowerCase())
      ? String(mood).toLowerCase()
      : null;
  }

  if (typeof isStarred === 'boolean') {
    fields.is_starred = isStarred;
  }

  const updated = await repo.updateThought(userId, id, fields);
  if (!updated) throw { status: 404, message: 'Thought not found' };

  const decorated = decorateThoughtMedia(updated);
  if (fields.content) {
    const linked = await peopleService.replaceThoughtMentions(
      userId,
      updated.id,
      updated.content,
      mentionedPersonIds
    );
    return { ...decorated, mentioned_person_ids: linked };
  }

  return decorated;
};

const searchThoughts = async (userId, filters) => {
  const rows = await repo.searchThoughts(userId, filters);
  return rows.map(decorateThoughtMedia);
};

const getTags = (userId) => repo.getTagsSummary(userId);

const getStats = (userId) => repo.getStats(userId);

const removeThought = async (userId, id) => {
  const deleted = await repo.deleteThought(userId, id);
  if (!deleted) throw { status: 404, message: 'Thought not found' };
  return deleted;
};

const removeThoughts = async (userId, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return repo.deleteThoughts(userId, ids);
};

module.exports = {
  getDays,
  getDayStream,
  addThought,
  editThought,
  searchThoughts,
  getTags,
  getStats,
  removeThought,
  removeThoughts,
  decorateThoughtMedia,
};
