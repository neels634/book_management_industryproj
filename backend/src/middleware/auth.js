const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { USER_STATUS } = require('../utils/constants');

const JWT_OPTIONS = { algorithms: ['HS256'], issuer: 'bms-api' };

/**
 * Verifies the Bearer token and loads the user on every request, so a
 * deactivated account or a revoked session (logout/password change) is
 * rejected immediately rather than when the token expires.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, JWT_OPTIONS);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid authentication token', 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.unauthorized('Account is not active', 'ACCOUNT_INACTIVE');
  }
  if (user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Your session has been signed out. Please log in again.', 'TOKEN_REVOKED');
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    role: user.role,
    member: user.member ? user.member.toString() : null,
  };
  next();
});

/** Allows the request only for the listed roles. Use after authenticate. */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: JWT_OPTIONS.issuer,
    algorithm: 'HS256',
  });
}

module.exports = { authenticate, authorize, signToken };
