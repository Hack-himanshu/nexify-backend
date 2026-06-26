const rateLimit = require('express-rate-limit');

/**
 * General-purpose limiter applied to all /api routes.
 */
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later.',
  },
});

/**
 * Stricter limiter for brute-force-sensitive auth endpoints (login, register,
 * forgot-password). Keyed by IP + email when available to limit per-account
 * attack attempts without blocking an entire office/NAT IP unnecessarily.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  keyGenerator: (req) => `${req.ip}-${req.body?.email || ''}`,
});

module.exports = { apiLimiter, authLimiter };
