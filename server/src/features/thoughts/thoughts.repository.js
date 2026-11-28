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

// Get all thoughts for a specific day (with reply preview, star, mood, tags)
const getThoughtsForDay = (userId, dayDate) =>
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
       r.content AS reply_to_preview,
       r.category AS reply_to_category,
       t.created_at, 
       t.updated_at
     FROM thoughts t
     LEFT JOIN thoughts r ON r.id = t.reply_to_id AND r.user_id = t.user_id
     WHERE t.user_id = $1 AND t.day_date = $2
     ORDER BY t.created_at ASC`,
    [userId, dayDate]
  );

// Get a single thought by id
const getThoughtById = (userId, id) =>
  queryOne(
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
       r.content AS reply_to_preview,
       r.category AS reply_to_category,
       t.created_at,
       t.updated_at
     FROM thoughts t
     LEFT JOIN thoughts r ON r.id = t.reply_to_id AND r.user_id = t.user_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );

// Create a new thought
const createThought = async ({
  userId,
  dayDate,
  content,
  category = 'thinking',
  mood = null,
  tags = [],
  replyToId = null,
}) => {
  // Enforce replyToId ownership to prevent cross-tenant reply preview IDOR
  let safeReplyToId = null;
  if (replyToId) {
    const target = await queryOne(
      'SELECT id FROM thoughts WHERE id = $1 AND user_id = $2',
      [replyToId, userId]
    );
    if (!target) {
      throw { status: 403, message: 'Forbidden reply target' };
    }
    safeReplyToId = target.id;
  }

  const createdRow = await queryOne(
    `INSERT INTO thoughts (user_id, day_date, content, category, mood, tags, reply_to_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, dayDate, content, category, mood, tags, safeReplyToId]
  );
  return getThoughtById(userId, createdRow.id);
};

// Update a thought (strict field allowlist)
const ALLOWED_THOUGHT_FIELDS = new Set(['content', 'mood', 'is_starred', 'tags']);

const updateThought = async (userId, id, fields) => {
  const keys = Object.keys(fields).filter((k) => ALLOWED_THOUGHT_FIELDS.has(k));
  if (keys.length === 0) return getThoughtById(userId, id);

  const values = keys.map((k) => fields[k]);
  const setClause = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const row = await queryOne(
    `UPDATE thoughts
     SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId, ...values]
  );
  if (!row) return null;
  return getThoughtById(userId, row.id);
};

const escapeLike = (str) => str.replace(/[\\%_]/g, '\\$&');

// Search and filter thoughts across all days
const searchThoughts = (userId, { q, type, mood, tag, starred, personId, dayDate, startDate, endDate }) => {
  const conditions = ['t.user_id = $1'];
  const params = [userId];
  let idx = 2;

  if (q && q.trim()) {
    conditions.push(`t.content ILIKE $${idx} ESCAPE '\\'`);
    params.push(`%${escapeLike(q.trim())}%`);
    idx += 1;
  }

  if (type && ['thinking', 'image', 'video', 'audio'].includes(type)) {
    conditions.push(`t.category = $${idx}`);
    params.push(type);
    idx += 1;
  }

  if (mood) {
    conditions.push(`t.mood = $${idx}`);
    params.push(mood);
    idx += 1;
  }

  if (tag) {
    conditions.push(`$${idx} = ANY(t.tags)`);
    params.push(tag.toLowerCase().replace(/^#/, ''));
    idx += 1;
  }

  if (starred === true || starred === 'true') {
    conditions.push('t.is_starred = TRUE');
  }

  if (personId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM thought_mentions tm WHERE tm.thought_id = t.id AND tm.person_id = $${idx} AND tm.user_id = $1)`
    );
    params.push(personId);
    idx += 1;
  }

  if (dayDate && /^\d{4}-\d{2}-\d{2}$/.test(String(dayDate))) {
    conditions.push(`t.day_date = $${idx}`);
    params.push(String(dayDate));
    idx += 1;
  }

  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) {
    conditions.push(`t.day_date >= $${idx}`);
    params.push(String(startDate));
    idx += 1;
  }

  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
    conditions.push(`t.day_date <= $${idx}`);
    params.push(String(endDate));
    idx += 1;
  }

  return query(
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
       r.content AS reply_to_preview,
       r.category AS reply_to_category,
       t.created_at,
       t.updated_at
     FROM thoughts t
     LEFT JOIN thoughts r ON r.id = t.reply_to_id AND r.user_id = t.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT 100`,
    params
  );
};

// List all #hashtags with counts
const getTagsSummary = (userId) =>
  query(
    `SELECT tag, COUNT(*)::int AS count
     FROM (
       SELECT UNNEST(tags) AS tag
       FROM thoughts
       WHERE user_id = $1
     ) sub
     WHERE tag <> ''
     GROUP BY tag
     ORDER BY count DESC, tag ASC
     LIMIT 50`,
    [userId]
  );

// Dashboard stats: active days, mood breakdown, latest mood, weekly recap
const getStats = async (userId) => {
  const [
    activeDays,
    moodCounts,
    latestMoodRow,
    weeklyCountRow,
    totalRow,
    topWeekMoodRow,
    topPersonRow,
    topTagRow,
  ] = await Promise.all([
    query(
      `SELECT TO_CHAR(day_date, 'YYYY-MM-DD') AS day_date, COUNT(*)::int AS count
       FROM thoughts
       WHERE user_id = $1 AND day_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY day_date
       ORDER BY day_date DESC`,
      [userId]
    ),
    query(
      `SELECT mood, COUNT(*)::int AS count
       FROM thoughts
       WHERE user_id = $1 AND mood IS NOT NULL
       GROUP BY mood`,
      [userId]
    ),
    queryOne(
      `SELECT mood
       FROM thoughts
       WHERE user_id = $1 AND mood IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    ),
    queryOne(
      `SELECT
         COUNT(*)::int AS total_week,
         COUNT(DISTINCT day_date)::int AS active_days_week
       FROM thoughts
       WHERE user_id = $1 AND day_date >= CURRENT_DATE - INTERVAL '6 days'`,
      [userId]
    ),
    queryOne(
      `SELECT COUNT(*)::int AS total_all
       FROM thoughts
       WHERE user_id = $1`,
      [userId]
    ),
    queryOne(
      `SELECT mood, COUNT(*)::int AS count
       FROM thoughts
       WHERE user_id = $1 AND mood IS NOT NULL AND day_date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY mood
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    ),
    queryOne(
      `SELECT p.id, p.name, p.handle, p.avatar_url, COUNT(tm.id)::int AS count
       FROM thought_mentions tm
       INNER JOIN people p ON p.id = tm.person_id
       INNER JOIN thoughts t ON t.id = tm.thought_id
       WHERE tm.user_id = $1 AND t.day_date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY p.id
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    ),
    queryOne(
      `SELECT tag, COUNT(*)::int AS count
       FROM (
         SELECT UNNEST(tags) AS tag
         FROM thoughts
         WHERE user_id = $1 AND day_date >= CURRENT_DATE - INTERVAL '6 days'
       ) sub
       WHERE tag <> ''
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    ),
  ]);

  return {
    activeDays,
    moodCounts,
    latestMood: latestMoodRow?.mood || null,
    weeklyCount: weeklyCountRow?.total_week || 0,
    activeDaysThisWeek: weeklyCountRow?.active_days_week || 0,
    totalCount: totalRow?.total_all || 0,
    topWeekMood: topWeekMoodRow?.mood || null,
    topPerson: topPersonRow || null,
    topTag: topTagRow || null,
  };
};

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
  getThoughtById,
  createThought,
  updateThought,
  searchThoughts,
  getTagsSummary,
  getStats,
  deleteThought,
  deleteThoughts,
};
