const { body, param, query } = require('express-validator');
const { isSafeExternalUrl } = require('../../middlewares/security.middleware');

const listPeopleRules = [
  query('q').optional().isString().isLength({ max: 80 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];

const personBodyFields = [
  body('handle')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Handle must be 50 characters or fewer'),
  body('avatarUrl')
    .optional({ nullable: true })
    .custom((val) => val === null || val === '' || isSafeExternalUrl(val))
    .withMessage('avatarUrl must be a valid URL'),
  body('avatarKey')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('avatarKey must be a valid key string'),
  body('relationship')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 40 }),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 500 }),
  body('birthday')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 20 }),
];

const createPersonRules = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  ...personBodyFields,
];

const updatePersonRules = [
  param('id').isUUID().withMessage('Invalid person ID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  ...personBodyFields,
];

const personIdRules = [
  param('id').isUUID().withMessage('Invalid person ID'),
];

module.exports = {
  listPeopleRules,
  createPersonRules,
  updatePersonRules,
  personIdRules,
};
