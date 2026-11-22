const { query, queryOne } = require('../../db/pool');

// Get list of all days with thought stats and latest thought preview
const getDaysSummary = (userId) =>
  query(
    `SELECT 
       TO_CHAR(day_date, 'YYYY-MM-DD') AS day_date,
       COUNT(*)::int AS thought_count,
       MAX(created_at) AS last_updated,
       (
         SELECT content 
         FROM thoughts t2 
         WHERE t2.user_id = $1 AND t2.day_date = t1.day_date 
         ORDER BY created_at DESC 
         LIMIT 1
       ) AS latest_preview,
       (
         SELECT category 
         FROM thoughts t3 
         WHERE t3.user_id = $1 AND t3.day_date = t1.day_date 
         ORDER BY created_at DESC 
         LIMIT 1
       ) AS latest_category
     FROM thoughts t1
     WHERE user_id = $1
     GROUP BY day_date
     ORDER BY day_date DESC`,
    [userId]
  );

// Get all thoughts for a specific day
const getThoughtsForDay = (userId, dayDate) =>
  query(
    `SELECT 
       id, 
       user_id, 
       TO_CHAR(day_date, 'YYYY-MM-DD') AS day_date,
       content, 
       category, 
       created_at, 
       updated_at
     FROM thoughts
     WHERE user_id = $1 AND day_date = $2
     ORDER BY created_at ASC`,
    [userId, dayDate]
  );

// Create a new thought
const createThought = ({ userId, dayDate, content, category = 'thinking' }) =>
  queryOne(
    `INSERT INTO thoughts (user_id, day_date, content, category)
     VALUES ($1, $2, $3, $4)
     RETURNING 
       id, 
       user_id, 
       TO_CHAR(day_date, 'YYYY-MM-DD') AS day_date, 
       content, 
       category, 
       created_at`,
    [userId, dayDate, content, category]
  );

// Delete a thought
const deleteThought = (userId, id) =>
  queryOne(
    `DELETE FROM thoughts 
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );

// Delete multiple thoughts
const deleteThoughts = (userId, ids) =>
  query(
    `DELETE FROM thoughts 
     WHERE id = ANY($1::uuid[]) AND user_id = $2
     RETURNING id`,
    [ids, userId]
  );

module.exports = {
  getDaysSummary,
  getThoughtsForDay,
  createThought,
  deleteThought,
  deleteThoughts,
};
