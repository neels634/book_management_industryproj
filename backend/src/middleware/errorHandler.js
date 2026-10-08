const mongoose = require('mongoose');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const DUPLICATE_MESSAGES = {
  isbn: ['DUPLICATE_ISBN', 'A book with this ISBN already exists'],
  username: ['DUPLICATE_USERNAME', 'This username is already taken'],
  email: ['DUPLICATE_EMAIL', 'A member with this e-mail already exists'],
  name: ['DUPLICATE_NAME', 'A record with this name already exists'],
  memberId: ['DUPLICATE_MEMBER_ID', 'Member ID already exists'],
  bookId: ['DUPLICATE_BOOK_ID', 'Book ID already exists'],
  transactionId: ['DUPLICATE_TRANSACTION_ID', 'Transaction ID already exists'],
};

function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON', 'INVALID_JSON');
  }
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.validation(details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`, 'INVALID_ID');
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (err.message && err.message.includes('one_open_loan_per_title')) {
      return ApiError.conflict('DUPLICATE_LOAN', 'This member already has this book on loan');
    }
    const [code, message] = DUPLICATE_MESSAGES[field] || ['DUPLICATE_KEY', `${field || 'Value'} already exists`];
    return ApiError.conflict(code, message);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = toApiError(err);

  if (!apiError) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: config.isProduction ? 'Something went wrong. Please try again.' : err.message,
      },
    });
  }

  const body = { success: false, error: { code: apiError.code, message: apiError.message } };
  if (apiError.details) body.error.details = apiError.details;
  return res.status(apiError.statusCode).json(body);
}

function notFound(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = { errorHandler, notFound, toApiError };
