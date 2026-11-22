const router = require('express').Router();
const controller = require('./auth.controller');
const { registerRules, loginRules, googleRules } = require('./auth.validator');
const { validate } = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/auth.middleware');

// Public routes
router.post('/register', registerRules, validate, controller.register);
router.post('/login',    loginRules,    validate, controller.login);
router.post('/google',   googleRules,   validate, controller.googleAuth);

// Protected
router.get('/me', protect, controller.getMe);

module.exports = router;
