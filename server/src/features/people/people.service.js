const repo = require('./people.repository');
const uploadService = require('../upload/upload.service');

// Build a clean URL/mention-friendly handle from a display name or custom input
const normalizeHandle = (raw) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'person';
};

// Generate a unique handle for this user, appending _2, _3... if needed
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

// Extract plain searchable text from either standard thought or attachment caption JSON
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

const listPeople = (userId) => repo.getPeopleByUser(userId);

const getPersonDetails = async (userId, personId) => {
  const [person, mentions] = await Promise.all([
    repo.getPersonById(userId, personId),
    repo.getMentionsForPerson(userId, personId),
  ]);
  if (!person) throw { status: 404, message: 'Person not found' };

  return { person, mentions };
};

const createPerson = async (userId, { name, handle, avatarUrl, avatarKey }) => {
  const cleanName = name.trim();
  const hasExplicitHandle = typeof handle === 'string' && handle.trim().length > 0;
  const baseHandle = normalizeHandle(hasExplicitHandle ? handle : cleanName);

  if (hasExplicitHandle) {
    const existing = await repo.findByHandle(userId, baseHandle);
    if (existing) {
      throw { status: 400, message: `Handle @${baseHandle} is already taken` };
    }
  }

  const uniqueHandle = hasExplicitHandle
    ? baseHandle
    : await ensureUniqueHandle(userId, baseHandle);

  return repo.createPerson({
    userId,
    name: cleanName,
    handle: uniqueHandle,
    avatarUrl: avatarUrl || null,
    avatarKey: avatarKey || null,
  });
};

const updatePerson = async (userId, personId, { name, handle, avatarUrl, avatarKey }) => {
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

  let oldKeyToDelete = null;
  if (avatarUrl !== undefined) {
    fields.avatar_url = avatarUrl || null;
  }
  if (avatarKey !== undefined) {
    if (existing.avatar_key && existing.avatar_key !== avatarKey) {
      oldKeyToDelete = existing.avatar_key;
    }
    fields.avatar_key = avatarKey || null;
  }

  const updated = await repo.updatePerson(userId, personId, fields);

  if (oldKeyToDelete) {
    uploadService.deleteObject(oldKeyToDelete).catch(() => {});
  }

  return updated;
};

const deletePerson = async (userId, personId) => {
  const deleted = await repo.deletePerson(userId, personId);
  if (!deleted) throw { status: 404, message: 'Person not found' };

  if (deleted.avatar_key) {
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
      `(^|[\\s(\\[{"'])@${escapeRegex(token)}(?=$|[\\s.,!?;:)\\]}"'])`,
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

  // 1. Honor explicit IDs selected via autocomplete first (resolves duplicate names accurately)
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

  // 2. Scan remaining text for @name or @handle matches (longest token first)
  const candidates = [];
  for (const person of people) {
    if (person.name?.trim()) {
      candidates.push({ personId: person.id, token: person.name.trim() });
    }
    if (person.handle?.trim() && person.handle.trim().toLowerCase() !== person.name?.trim().toLowerCase()) {
      candidates.push({ personId: person.id, token: person.handle.trim() });
    }
  }
  candidates.sort((a, b) => b.token.length - a.token.length);

  for (const { personId, token } of candidates) {
    const regex = new RegExp(
      `(^|[\\s(\\[{"'])@${escapeRegex(token)}(?=$|[\\s.,!?;:)\\]}"'])`,
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

module.exports = {
  listPeople,
  getPersonDetails,
  createPerson,
  updatePerson,
  deletePerson,
  linkThoughtMentions,
};
