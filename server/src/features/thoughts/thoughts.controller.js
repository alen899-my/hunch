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
  deleteThought,
  bulkDeleteThoughts,
};
