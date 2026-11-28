const { query, queryOne, pool } = require('../../db/pool');

// List all people for a user with mention counts and last mentioned timestamp
const getPeopleByUser = (userId) =>
  query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.handle,
       p.avatar_url,
       p.avatar_key,
       p.relationship,
       p.notes,
       p.birthday,
       p.created_at,
       p.updated_at,
       COUNT(tm.id)::int AS mention_count,
       MAX(t.created_at) AS last_mentioned_at
     FROM people p
     LEFT JOIN thought_mentions tm ON tm.person_id = p.id
     LEFT JOIN thoughts t ON t.id = tm.thought_id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY COALESCE(MAX(t.created_at), p.created_at) DESC, LOWER(p.name) ASC`,
    [userId]
  );

// Search people for autocomplete only when a query string is provided
const searchPeopleByUser = (userId, q, limit = 15) => {
  const pattern = `%${q}%`;
  const prefix = `${q.toLowerCase()}%`;
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 50);
  return query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.handle,
       p.avatar_url,
       p.avatar_key,
       p.relationship,
       p.notes,
       p.birthday,
       p.created_at,
       p.updated_at,
       COUNT(tm.id)::int AS mention_count,
       MAX(t.created_at) AS last_mentioned_at
     FROM people p
     LEFT JOIN thought_mentions tm ON tm.person_id = p.id
     LEFT JOIN thoughts t ON t.id = tm.thought_id
     WHERE p.user_id = $1
       AND (p.name ILIKE $2 OR p.handle ILIKE $2)
     GROUP BY p.id
     ORDER BY
       CASE WHEN LOWER(p.name) LIKE $3 OR LOWER(p.handle) LIKE $3 THEN 0 ELSE 1 END,
       COUNT(tm.id) DESC,
       LOWER(p.name) ASC
     LIMIT $4`,
    [userId, pattern, prefix, safeLimit]
  );
};

// Load only people actually mentioned on a specific day stream
const getMentionedPeopleForDay = (userId, dayDate) =>
  query(
    `SELECT DISTINCT
       p.id,
       p.user_id,
       p.name,
       p.handle,
       p.avatar_url,
       p.avatar_key,
       p.relationship,
       p.notes,
       p.birthday,
       p.created_at,
       p.updated_at,
       0::int AS mention_count,
       NULL::timestamptz AS last_mentioned_at
     FROM thought_mentions tm
     INNER JOIN thoughts t ON t.id = tm.thought_id
     INNER JOIN people p ON p.id = tm.person_id
     WHERE t.user_id = $1 AND t.day_date = $2`,
    [userId, dayDate]
  );

// Get a single person with mention count
const getPersonById = (userId, personId) =>
  queryOne(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.handle,
       p.avatar_url,
       p.avatar_key,
       p.relationship,
       p.notes,
       p.birthday,
       p.created_at,
       p.updated_at,
       COUNT(tm.id)::int AS mention_count,
       MAX(t.created_at) AS last_mentioned_at
     FROM people p
     LEFT JOIN thought_mentions tm ON tm.person_id = p.id
     LEFT JOIN thoughts t ON t.id = tm.thought_id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [personId, userId]
  );

// Minimal list of people for mention parsing
const getAllPeopleMinimal = (userId) =>
  query(
    `SELECT id, name, handle, avatar_url
     FROM people
     WHERE user_id = $1`,
    [userId]
  );

// Check handle uniqueness within a user's people list
const findByHandle = (userId, handle, excludeId = null) => {
  if (excludeId) {
    return queryOne(
      `SELECT id FROM people WHERE user_id = $1 AND LOWER(handle) = LOWER($2) AND id <> $3`,
      [userId, handle, excludeId]
    );
  }
  return queryOne(
    `SELECT id FROM people WHERE user_id = $1 AND LOWER(handle) = LOWER($2)`,
    [userId, handle]
  );
};

// Create a person
const createPerson = ({
  userId,
  name,
  handle,
  avatarUrl = null,
  avatarKey = null,
  relationship = null,
  notes = null,
  birthday = null,
}) =>
  queryOne(
    `INSERT INTO people (user_id, name, handle, avatar_url, avatar_key, relationship, notes, birthday)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING
       id,
       user_id,
       name,
       handle,
       avatar_url,
       avatar_key,
       relationship,
       notes,
       birthday,
       created_at,
       updated_at,
       0::int AS mention_count,
       NULL::timestamptz AS last_mentioned_at`,
    [userId, name, handle, avatarUrl, avatarKey, relationship, notes, birthday]
  );

// Update a person (strict field allowlist)
const ALLOWED_PERSON_FIELDS = new Set([
  'name',
  'handle',
  'avatar_url',
  'avatar_key',
  'relationship',
  'notes',
  'birthday',
]);

const updatePerson = (userId, personId, fields) => {
  const keys = Object.keys(fields).filter((k) => ALLOWED_PERSON_FIELDS.has(k));
  if (keys.length === 0) return getPersonById(userId, personId);

  const values = keys.map((k) => fields[k]);
  const setClause = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  return queryOne(
    `UPDATE people
     SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [personId, userId, ...values]
  ).then((row) => (row ? getPersonById(userId, personId) : null));
};

// Delete a person
const deletePerson = (userId, personId) =>
  queryOne(
    `DELETE FROM people
     WHERE id = $1 AND user_id = $2
     RETURNING id, avatar_key`,
    [personId, userId]
  );

// Get all mentioned thoughts for a specific person
const getMentionsForPerson = (userId, personId) =>
  query(
    `SELECT
       t.id,
       t.user_id,
       TO_CHAR(t.day_date, 'YYYY-MM-DD') AS day_date,
       t.content,
       t.category,
       t.is_starred,
       t.mood,
       t.tags,
       t.reply_to_id,
       t.created_at,
       t.updated_at,
       tm.created_at AS mentioned_at,
       ARRAY(
         SELECT tm2.person_id
         FROM thought_mentions tm2
         WHERE tm2.thought_id = t.id AND tm2.person_id <> $1 AND tm2.user_id = $2
       ) AS co_mentioned_ids
     FROM thought_mentions tm
     INNER JOIN thoughts t ON t.id = tm.thought_id
     WHERE tm.person_id = $1 AND tm.user_id = $2 AND t.user_id = $2
     ORDER BY t.created_at DESC`,
    [personId, userId]
  );

// Remove all mentions for a thought (used when editing thought content)
const clearMentionsForThought = (userId, thoughtId) =>
  query(
    `DELETE FROM thought_mentions WHERE thought_id = $1 AND user_id = $2`,
    [thoughtId, userId]
  );

// Link mentioned people to a thought (database-enforced tenant ownership check)
const addMentionsForThought = async (userId, thoughtId, personIds) => {
  if (!Array.isArray(personIds) || personIds.length === 0) return [];
  const uniqueIds = [...new Set(personIds)];

  const result = await pool.query(
    `INSERT INTO thought_mentions (thought_id, person_id, user_id)
     SELECT $1, p.id, $2
     FROM people p
     WHERE p.id = ANY($3::uuid[]) AND p.user_id = $2
     ON CONFLICT (thought_id, person_id) DO NOTHING
     RETURNING person_id`,
    [thoughtId, userId, uniqueIds]
  );
  return result.rows.map((r) => r.person_id);
};

module.exports = {
  getPeopleByUser,
  searchPeopleByUser,
  getMentionedPeopleForDay,
  getPersonById,
  getAllPeopleMinimal,
  findByHandle,
  createPerson,
  updatePerson,
  deletePerson,
  getMentionsForPerson,
  addMentionsForThought,
  clearMentionsForThought,
};
