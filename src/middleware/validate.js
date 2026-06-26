const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs after an array of express-validator checks. If any failed, short-circuits
 * with a 400 and a normalized list of field errors. Usage:
 *   router.post('/register', registerValidators, validate, authController.register)
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  next(ApiError.badRequest('Validation failed', errors));
};

module.exports = validate;
