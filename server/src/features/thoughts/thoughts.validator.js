const { body, param, query } = require('express-validator');

const ALLOWED_MOODS = [
  'happy',
  'sad',
  'calm',
  'anxious',
  'grateful',
  'excited',
  'loved',
  'tired',
  'angry',
];

const ALLOWED_CATEGORIES = ['thinking', 'image', 'video', 'audio'];

const createThoughtRules = [
  body('content')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Thought content is required')
    .isLength({ max: 8000 })
    .withMessage('Thought content exceeds maximum length'),
  body('dayDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('category')
    .optional()
    .isIn(ALLOWED_CATEGORIES)
    .withMessage('Invalid category'),
  body('mood')
    .optional({ nullable: true })
    .isIn(ALLOWED_MOODS)
    .withMessage('Invalid mood'),
  body('replyToId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('replyToId must be a valid UUID'),
  body('mentionedPersonIds')
    .optional()
    .isArray({ max: 50 })
    .withMessage('mentionedPersonIds must be an array'),
  body('mentionedPersonIds.*')
    .optional()
    .isUUID()
    .withMessage('Each mentioned person ID must be a valid UUID'),
];

const updateThoughtRules = [
  param('id').isUUID().withMessage('Invalid thought ID'),
  body('content')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Thought content cannot be empty')
    .isLength({ max: 8000 })
    .withMessage('Thought content exceeds maximum length'),
  body('mood')
    .optional({ nullable: true })
    .custom((v) => v === null || ALLOWED_MOODS.includes(v))
    .withMessage('Invalid mood'),
  body('isStarred')
    .optional()
    .isBoolean()
    .withMessage('isStarred must be a boolean'),
  body('mentionedPersonIds')
    .optional()
    .isArray({ max: 50 }),
  body('mentionedPersonIds.*')
    .optional()
    .isUUID()
    .withMessage('Each mentioned person ID must be a valid UUID'),
];

const dayParamRules = [
  param('dayDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
];

const thoughtIdRules = [
  param('id').isUUID().withMessage('Invalid thought ID'),
];

const bulkDeleteRules = [
  body('ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('ids must be a non-empty array of at most 100 items'),
  body('ids.*').isUUID().withMessage('Each thought ID must be a valid UUID'),
];

const searchThoughtsRules = [
  query('q').optional().isString().isLength({ max: 120 }),
  query('type').optional().isIn(ALLOWED_CATEGORIES),
  query('mood').optional().isIn(ALLOWED_MOODS),
  query('tag').optional().isString().isLength({ max: 45 }),
  query('personId').optional().isUUID().withMessage('Invalid personId'),
  query('dayDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
];

module.exports = {
  createThoughtRules,
  updateThoughtRules,
  dayParamRules,
  thoughtIdRules,
  bulkDeleteRules,
  searchThoughtsRules,
};
