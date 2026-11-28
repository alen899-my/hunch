const { body } = require('express-validator');
const { isSafeExternalUrl } = require('../../middlewares/security.middleware');

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail()
    .withMessage('Valid email required')
    .isLength({ max: 160 }),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone required'),
  body('password')
    .isString()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters'),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) throw new Error('Email or phone is required');
    return true;
  }),
];

const loginRules = [
  body('email').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('Password is required'),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) throw new Error('Email or phone is required');
    return true;
  }),
];

const googleRules = [
  body('idToken').isString().notEmpty().isLength({ max: 4096 }).withMessage('Google idToken is required'),
];

const updateMeRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  body('phone')
    .optional({ nullable: true })
    .custom((val) => val === null || typeof val === 'string')
    .withMessage('Invalid phone value'),
  body('avatar')
    .optional({ nullable: true })
    .custom((val) => val === null || val === '' || isSafeExternalUrl(val))
    .withMessage('Invalid avatar URL'),
];

const changePasswordRules = [
  body('oldPassword').optional({ nullable: true }).isString().isLength({ max: 128 }),
  body('newPassword')
    .isString()
    .isLength({ min: 6, max: 128 })
    .withMessage('New password must be 6-128 characters'),
];

module.exports = {
  registerRules,
  loginRules,
  googleRules,
  updateMeRules,
  changePasswordRules,
};
