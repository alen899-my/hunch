const router = require('express').Router();
const controller = require('./people.controller');
const {
  listPeopleRules,
  createPersonRules,
  updatePersonRules,
  personIdRules,
} = require('./people.validator');
const { validate } = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/auth.middleware');

// All people endpoints require strict authentication
router.use(protect);

// GET /api/people - List all created people with mention counts
router.get('/', listPeopleRules, validate, controller.listPeople);

// GET /api/people/:id - Person details and all thoughts mentioning them
router.get('/:id', personIdRules, validate, controller.getPersonDetails);

// POST /api/people - Create a new person
router.post('/', createPersonRules, validate, controller.createPerson);

// PATCH /api/people/:id - Update person details or profile picture
router.patch('/:id', updatePersonRules, validate, controller.updatePerson);

// DELETE /api/people/:id - Remove a person
router.delete('/:id', personIdRules, validate, controller.deletePerson);

module.exports = router;
