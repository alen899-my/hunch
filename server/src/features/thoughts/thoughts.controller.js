const service = require('./thoughts.service');
const { ok, created, serverError } = require('../../utils/response');

const handleError = (res, err) => {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return serverError(res, err);
};

const getDays = async (req, res) => {
  try {
    const days = await service.getDays(req.user.id);
    ok(res, { days });
  } catch (err) {
    handleError(res, err);
  }
};

const getDayStream = async (req, res) => {
  try {
    const result = await service.getDayStream(req.user.id, req.params.dayDate);
    ok(res, result);
  } catch (err) {
    handleError(res, err);
  }
};

const createThought = async (req, res) => {
  try {
    const thought = await service.addThought(req.user.id, req.body);
    created(res, { thought }, 'Thought recorded');
  } catch (err) {
    handleError(res, err);
  }
};

const updateThought = async (req, res) => {
  try {
    const thought = await service.editThought(req.user.id, req.params.id, req.body);
    ok(res, { thought }, 'Thought updated');
  } catch (err) {
    handleError(res, err);
  }
};

const searchThoughts = async (req, res) => {
  try {
    const thoughts = await service.searchThoughts(req.user.id, req.query);
    ok(res, { thoughts });
  } catch (err) {
    handleError(res, err);
  }
};

const getTags = async (req, res) => {
  try {
    const tags = await service.getTags(req.user.id);
    ok(res, { tags });
  } catch (err) {
    handleError(res, err);
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await service.getStats(req.user.id);
    ok(res, { stats });
  } catch (err) {
    handleError(res, err);
  }
};

const deleteThought = async (req, res) => {
  try {
    const deleted = await service.removeThought(req.user.id, req.params.id);
    ok(res, { id: deleted.id }, 'Thought deleted');
  } catch (err) {
    handleError(res, err);
  }
};

const bulkDeleteThoughts = async (req, res) => {
  try {
    const { ids } = req.body;
    const deleted = await service.removeThoughts(req.user.id, ids);
    ok(res, { deletedIds: deleted.map((d) => d.id) }, 'Thoughts deleted');
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = {
  getDays,
  getDayStream,
  createThought,
  updateThought,
  searchThoughts,
  getTags,
  getStats,
  deleteThought,
  bulkDeleteThoughts,
};
