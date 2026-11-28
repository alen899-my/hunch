const repo = require('./people.repository');
const uploadService = require('../upload/upload.service');
const {
  attachMediaSignature,
  isSafeExternalUrl,
  signAttachmentThoughtContent,
} = require('../../middlewares/security.middleware');

const normalizeHandle = (raw) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'person';
};

const ensureUniqueHandle = async (userId, baseHandle, excludeId = null) => {
  let candidate = baseHandle;
  let suffix = 2;
  while (await repo.findByHandle(userId, candidate, excludeId)) {
    candidate = `${baseHandle}_${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
      // treat as normal text
    }
  }
  return content;
};

const decoratePersonMedia = (person) => {
  if (!person || !person.avatar_url) return person;
  return { ...person, avatar_url: attachMediaSignature(person.avatar_url) };
};

const validateAvatarForUser = (userId, avatarUrl, avatarKey) => {
  let cleanKey;
  if (avatarKey !== undefined) {
    if (!avatarKey) {
      cleanKey = null;
    } else if (!uploadService.isUserUploadKey(userId, avatarKey)) {
      throw { status: 403, message: 'Forbidden avatar key' };
    } else {
      cleanKey = avatarKey;
    }
  }

  let cleanUrl;
  if (avatarUrl !== undefined) {
    if (!avatarUrl) {
      cleanUrl = null;
    } else if (!isSafeExternalUrl(avatarUrl)) {
      throw { status: 400, message: 'Invalid avatar URL' };
    } else {
      const base = String(avatarUrl).trim().split('?')[0];
      if (base.includes('/api/upload/raw/') && !base.includes(`/uploads/${userId}/`)) {
        throw { status: 403, message: 'Forbidden avatar resource' };
      }
      cleanUrl = base;
    }
  }

  return { cleanUrl, cleanKey };
};

const listPeople = async (userId, q, limit) => {
  const cleanQuery = typeof q === 'string' ? q.trim() : '';
  const rows =
    cleanQuery.length > 0
      ? await repo.searchPeopleByUser(userId, cleanQuery, limit)
      : await repo.getPeopleByUser(userId);
  return rows.map(decoratePersonMedia);
};

const getMentionedPeopleForDay = async (userId, dayDate) => {
  const rows = await repo.getMentionedPeopleForDay(userId, dayDate);
  return rows.map(decoratePersonMedia);
};

const getPersonDetails = async (userId, personId) => {
  const [person, mentions] = await Promise.all([
    repo.getPersonById(userId, personId),
    repo.getMentionsForPerson(userId, personId),
  ]);
  if (!person) throw { status: 404, message: 'Person not found' };

  return {
    person: decoratePersonMedia(person),
    mentions: mentions.map((m) => ({
      ...m,
      content: signAttachmentThoughtContent(userId, m.content),
    })),
  };
};

const createPerson = async (
  userId,
  { name, handle, avatarUrl, avatarKey, relationship, notes, birthday }
) => {
  const cleanName = name.trim();
  const hasExplicitHandle = typeof handle === 'string' && handle.trim().length > 0;
  const baseHandle = normalizeHandle(hasExplicitHandle ? handle : cleanName);

  if (hasExplicitHandle) {
    const existing = await repo.findByHandle(userId, baseHandle);
    if (existing) {
      throw { status: 400, message: `Handle @${baseHandle} is already taken` };
    }
  }

  const { cleanUrl, cleanKey } = validateAvatarForUser(userId, avatarUrl, avatarKey);
  const uniqueHandle = hasExplicitHandle
    ? baseHandle
    : await ensureUniqueHandle(userId, baseHandle);

  const created = await repo.createPerson({
    userId,
    name: cleanName,
    handle: uniqueHandle,
    avatarUrl: cleanUrl ?? null,
    avatarKey: cleanKey ?? null,
    relationship: relationship?.trim() || null,
    notes: notes?.trim() || null,
    birthday: birthday?.trim() || null,
  });
  return decoratePersonMedia(created);
};

const updatePerson = async (
  userId,
  personId,
  { name, handle, avatarUrl, avatarKey, relationship, notes, birthday }
) => {
  const existing = await repo.getPersonById(userId, personId);
  if (!existing) throw { status: 404, message: 'Person not found' };

  const fields = {};
  if (typeof name === 'string' && name.trim().length > 0) {
    fields.name = name.trim();
  }

  if (typeof handle === 'string' && handle.trim().length > 0) {
    const normalized = normalizeHandle(handle);
    const conflict = await repo.findByHandle(userId, normalized, personId);
    if (conflict) {
      throw { status: 400, message: `Handle @${normalized} is already taken` };
    }
    fields.handle = normalized;
  }

  if (relationship !== undefined) {
    fields.relationship = relationship ? String(relationship).trim() : null;
  }
  if (notes !== undefined) {
    fields.notes = notes ? String(notes).trim() : null;
  }
  if (birthday !== undefined) {
    fields.birthday = birthday ? String(birthday).trim() : null;
  }

  const { cleanUrl, cleanKey } = validateAvatarForUser(userId, avatarUrl, avatarKey);
  let oldKeyToDelete = null;
  if (cleanUrl !== undefined) {
    fields.avatar_url = cleanUrl;
  }
  if (cleanKey !== undefined) {
    if (
      existing.avatar_key &&
      existing.avatar_key !== cleanKey &&
      uploadService.isUserUploadKey(userId, existing.avatar_key)
    ) {
      oldKeyToDelete = existing.avatar_key;
    }
    fields.avatar_key = cleanKey;
  }

  const updated = await repo.updatePerson(userId, personId, fields);

  if (oldKeyToDelete) {
    uploadService.deleteObject(oldKeyToDelete).catch(() => {});
  }

  return decoratePersonMedia(updated);
};

const deletePerson = async (userId, personId) => {
  const deleted = await repo.deletePerson(userId, personId);
  if (!deleted) throw { status: 404, message: 'Person not found' };

  if (deleted.avatar_key && uploadService.isUserUploadKey(userId, deleted.avatar_key)) {
    uploadService.deleteObject(deleted.avatar_key).catch(() => {});
  }

  return deleted;
};

/**
 * Parse @mentions from a thought's text (or media caption), combine with any
 * validated explicit IDs chosen from autocomplete, and persist links in thought_mentions.
 */
const linkThoughtMentions = async (userId, thoughtId, content, explicitIds = []) => {
  const searchableText = extractSearchableText(content);
  if (!searchableText || !searchableText.includes('@')) return [];

  const people = await repo.getAllPeopleMinimal(userId);
  if (!people || people.length === 0) return [];

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const matchedIds = new Set();
  const occupiedRanges = [];

  const isRangeFree = (start, end) =>
    !occupiedRanges.some(([s, e]) => Math.max(s, start) < Math.min(e, end));

  const findTokenSpan = (token) => {
    if (!token) return null;
    const regex = new RegExp(
      `(^|[\\s(\\[{"',])@${escapeRegex(token)}(?=$|[\\s.,!?;:)\\]}"'])`,
      'gi'
    );
    let match;
    while ((match = regex.exec(searchableText)) !== null) {
      const start = match.index + match[1].length;
      const end = start + 1 + token.length;
      if (isRangeFree(start, end)) {
        return [start, end];
      }
    }
    return null;
  };

  if (Array.isArray(explicitIds)) {
    for (const rawId of explicitIds) {
      const person = peopleById.get(rawId);
      if (!person) continue;
      const span = findTokenSpan(person.name) || findTokenSpan(person.handle);
      if (span) {
        matchedIds.add(person.id);
        occupiedRanges.push(span);
      }
    }
  }

  const candidates = [];
  for (const person of people) {
    if (person.name?.trim()) {
      candidates.push({ personId: person.id, token: person.name.trim() });
    }
    if (
      person.handle?.trim() &&
      person.handle.trim().toLowerCase() !== person.name?.trim().toLowerCase()
    ) {
      candidates.push({ personId: person.id, token: person.handle.trim() });
    }
  }
  candidates.sort((a, b) => b.token.length - a.token.length);

  for (const { personId, token } of candidates) {
    const regex = new RegExp(
      `(^|[\\s(\\[{"',])@${escapeRegex(token)}(?=$|[\\s.,!?;:)\\]}"'])`,
      'gi'
    );
    let match;
    while ((match = regex.exec(searchableText)) !== null) {
      const start = match.index + match[1].length;
      const end = start + 1 + token.length;
      if (isRangeFree(start, end)) {
        matchedIds.add(personId);
        occupiedRanges.push([start, end]);
      }
    }
  }

  if (matchedIds.size === 0) return [];
  return repo.addMentionsForThought(userId, thoughtId, [...matchedIds]);
};

const replaceThoughtMentions = async (userId, thoughtId, content, explicitIds = []) => {
  await repo.clearMentionsForThought(userId, thoughtId);
  return linkThoughtMentions(userId, thoughtId, content, explicitIds);
};

module.exports = {
  listPeople,
  getMentionedPeopleForDay,
  getPersonDetails,
  createPerson,
  updatePerson,
  deletePerson,
  linkThoughtMentions,
  replaceThoughtMentions,
};
