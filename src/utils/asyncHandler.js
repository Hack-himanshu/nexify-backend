/**
 * Wraps an async route handler and forwards any rejected promise to next(),
 * so the global error middleware handles it. Avoids try/catch boilerplate
 * in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
