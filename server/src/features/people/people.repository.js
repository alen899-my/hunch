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
const createPerson = ({ userId, name, handle, avatarUrl = null, avatarKey = null }) =>
  queryOne(
    `INSERT INTO people (user_id, name, handle, avatar_url, avatar_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       user_id,
       name,
       handle,
       avatar_url,
       avatar_key,
       created_at,
       updated_at,
       0::int AS mention_count,
       NULL::timestamptz AS last_mentioned_at`,
    [userId, name, handle, avatarUrl, avatarKey]
  );

// Update a person
const updatePerson = (userId, personId, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return getPersonById(userId, personId);

  const values = Object.values(fields);
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
       t.created_at,
       t.updated_at,
       tm.created_at AS mentioned_at
     FROM thought_mentions tm
     INNER JOIN thoughts t ON t.id = tm.thought_id
     WHERE tm.person_id = $1 AND tm.user_id = $2
     ORDER BY t.created_at DESC`,
    [personId, userId]
  );

// Link mentioned people to a thought
const addMentionsForThought = async (userId, thoughtId, personIds) => {
  if (!Array.isArray(personIds) || personIds.length === 0) return [];
  const uniqueIds = [...new Set(personIds)];
  const values = [];
  const placeholders = uniqueIds.map((pid, idx) => {
    const base = idx * 3;
    values.push(thoughtId, pid, userId);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  const result = await pool.query(
    `INSERT INTO thought_mentions (thought_id, person_id, user_id)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (thought_id, person_id) DO NOTHING
     RETURNING person_id`,
    values
  );
  return result.rows.map((r) => r.person_id);
};

module.exports = {
  getPeopleByUser,
  getPersonById,
  getAllPeopleMinimal,
  findByHandle,
  createPerson,
  updatePerson,
  deletePerson,
  getMentionsForPerson,
  addMentionsForThought,
};
