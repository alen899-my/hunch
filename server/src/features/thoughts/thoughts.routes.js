const router = require('express').Router();
const controller = require('./thoughts.controller');
const { createThoughtRules, dayParamRules } = require('./thoughts.validator');
const { validate } = require('../../middlewares/validate.middleware');
const { optionalOrGuestProtect } = require('../../middlewares/auth.middleware');

// Thoughts routes are protected (with seamless guest fallback so thoughts always save!)
router.use(optionalOrGuestProtect);

// GET /api/thoughts/days - List of days with summaries
router.get('/days', controller.getDays);

// GET /api/thoughts/:dayDate - Thoughts stream for a specific day
router.get('/:dayDate', dayParamRules, validate, controller.getDayStream);

// POST /api/thoughts - Add a thought to a day
router.post('/', createThoughtRules, validate, controller.createThought);

// POST /api/thoughts/bulk-delete - Remove multiple thoughts
router.post('/bulk-delete', controller.bulkDeleteThoughts);

// DELETE /api/thoughts/:id - Remove a single thought
router.delete('/:id', controller.deleteThought);

module.exports = router;
