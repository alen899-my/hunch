const router = require('express').Router();
const controller = require('./auth.controller');
const {
  registerRules,
  loginRules,
  googleRules,
  updateMeRules,
  changePasswordRules,
} = require('./auth.validator');
const { validate } = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/auth.middleware');
const { createRateLimiter } = require('../../middlewares/security.middleware');

// Strict brute-force / credential-stuffing protection on auth endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
});

// Public routes
router.post('/register', authLimiter, registerRules, validate, controller.register);
router.post('/login',    authLimiter, loginRules,    validate, controller.login);
router.post('/google',   authLimiter, googleRules,   validate, controller.googleAuth);

// Protected
router.get('/me', protect, controller.getMe);
router.patch('/me', protect, updateMeRules, validate, controller.updateMe);
router.post('/change-password', protect, authLimiter, changePasswordRules, validate, controller.changePassword);

module.exports = router;
