const router = require('express').Router();
const controller = require('./thoughts.controller');
const {
  createThoughtRules,
  updateThoughtRules,
  dayParamRules,
  thoughtIdRules,
  bulkDeleteRules,
  searchThoughtsRules,
} = require('./thoughts.validator');
const { validate } = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/auth.middleware');

// All thought endpoints require strict authentication
router.use(protect);

// GET /api/thoughts/days - List of days with summaries
router.get('/days', controller.getDays);

// GET /api/thoughts/search - Global search & filter across thoughts
router.get('/search', searchThoughtsRules, validate, controller.searchThoughts);

// GET /api/thoughts/tags - All #hashtags with usage counts
router.get('/tags', controller.getTags);

// GET /api/thoughts/stats - Emotions breakdown, active days, and weekly recap
router.get('/stats', controller.getStats);

// GET /api/thoughts/:dayDate - Thoughts stream for a specific day
router.get('/:dayDate', dayParamRules, validate, controller.getDayStream);

// POST /api/thoughts - Add a thought to a day
router.post('/', createThoughtRules, validate, controller.createThought);

// POST /api/thoughts/bulk-delete - Remove multiple thoughts
router.post('/bulk-delete', bulkDeleteRules, validate, controller.bulkDeleteThoughts);

// PATCH /api/thoughts/:id - Edit content, mood, or star status
router.patch('/:id', updateThoughtRules, validate, controller.updateThought);

// DELETE /api/thoughts/:id - Remove a single thought
router.delete('/:id', thoughtIdRules, validate, controller.deleteThought);

module.exports = router;
