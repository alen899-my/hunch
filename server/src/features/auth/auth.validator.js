const { body } = require('express-validator');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // At least email or phone must be provided
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) throw new Error('Email or phone is required');
    return true;
  }),
];

const loginRules = [
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) throw new Error('Email or phone is required');
    return true;
  }),
];

const googleRules = [
  body('idToken').notEmpty().withMessage('Google idToken is required'),
];

module.exports = { registerRules, loginRules, googleRules };
