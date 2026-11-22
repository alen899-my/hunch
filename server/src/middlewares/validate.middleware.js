const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/response');

// Drop this after any express-validator chain
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, errors.array()[0].msg);
  }
  next();
};

module.exports = { validate };
