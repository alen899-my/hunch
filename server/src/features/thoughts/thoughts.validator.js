const { body, param, query: reqQuery } = require('express-validator');

const createThoughtRules = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Thought content is required'),
  body('dayDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('category')
    .optional()
    .isString(),
  body('mentionedPersonIds')
    .optional()
    .isArray()
    .withMessage('mentionedPersonIds must be an array'),
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

module.exports = {
  createThoughtRules,
  dayParamRules,
};
