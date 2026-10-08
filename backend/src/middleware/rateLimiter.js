const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (req, res, next) =>
    next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.')),
};

const apiLimiter = rateLimit({
  ...common,
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
});

// Brute-force protection for login: only failed attempts count.
const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimit.authMax,
  skipSuccessfulRequests: true,
  handler: (req, res, next) =>
    next(new ApiError(429, 'RATE_LIMITED', 'Too many login attempts. Please try again in 15 minutes.')),
});

module.exports = { apiLimiter, authLimiter };
