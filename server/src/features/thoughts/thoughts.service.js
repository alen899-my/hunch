const repo = require('./thoughts.repository');

const getTodayDate = () => new Date().toISOString().split('T')[0];

const getDays = async (userId) => {
  const days = await repo.getDaysSummary(userId);
  return days;
};

const getDayStream = async (userId, dayDate) => {
  const date = dayDate || getTodayDate();
  const thoughts = await repo.getThoughtsForDay(userId, date);
  return {
    dayDate: date,
    thoughts,
  };
};

const addThought = async (userId, { dayDate, content, category }) => {
  const date = dayDate || getTodayDate();
  const validCategory = category || 'thinking';
  const thought = await repo.createThought({
    userId,
    dayDate: date,
    content: content.trim(),
    category: validCategory,
  });
  return thought;
};

const removeThought = async (userId, id) => {
  const deleted = await repo.deleteThought(userId, id);
  if (!deleted) throw { status: 404, message: 'Thought not found' };
  return deleted;
};

const removeThoughts = async (userId, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const deleted = await repo.deleteThoughts(userId, ids);
  return deleted;
};

module.exports = {
  getDays,
  getDayStream,
  addThought,
  removeThought,
  removeThoughts,
};
