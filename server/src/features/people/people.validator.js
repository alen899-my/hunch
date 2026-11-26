const { body, param } = require('express-validator');

const createPersonRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  body('handle')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Handle must be 50 characters or fewer'),
  body('avatarUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('avatarUrl must be a string'),
  body('avatarKey')
    .optional({ nullable: true })
    .isString()
    .withMessage('avatarKey must be a string'),
];

const updatePersonRules = [
  param('id').isUUID().withMessage('Invalid person ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  body('handle')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Handle must be 50 characters or fewer'),
  body('avatarUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('avatarUrl must be a string'),
  body('avatarKey')
    .optional({ nullable: true })
    .isString()
    .withMessage('avatarKey must be a string'),
];

const personIdRules = [
  param('id').isUUID().withMessage('Invalid person ID'),
];

module.exports = {
  createPersonRules,
  updatePersonRules,
  personIdRules,
};
