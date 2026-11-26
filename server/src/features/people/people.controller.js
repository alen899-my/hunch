const service = require('./people.service');
const { ok, created, serverError } = require('../../utils/response');

const handleError = (res, err) => {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return serverError(res, err);
};

const listPeople = async (req, res) => {
  try {
    const people = await service.listPeople(req.user.id);
    ok(res, { people });
  } catch (err) {
    handleError(res, err);
  }
};

const getPersonDetails = async (req, res) => {
  try {
    const result = await service.getPersonDetails(req.user.id, req.params.id);
    ok(res, result);
  } catch (err) {
    handleError(res, err);
  }
};

const createPerson = async (req, res) => {
  try {
    const person = await service.createPerson(req.user.id, req.body);
    created(res, { person }, 'Person added');
  } catch (err) {
    handleError(res, err);
  }
};

const updatePerson = async (req, res) => {
  try {
    const person = await service.updatePerson(req.user.id, req.params.id, req.body);
    ok(res, { person }, 'Person updated');
  } catch (err) {
    handleError(res, err);
  }
};

const deletePerson = async (req, res) => {
  try {
    const deleted = await service.deletePerson(req.user.id, req.params.id);
    ok(res, { id: deleted.id }, 'Person deleted');
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = {
  listPeople,
  getPersonDetails,
  createPerson,
  updatePerson,
  deletePerson,
};
