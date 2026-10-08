/**
 * Operational error carrying an HTTP status and a stable machine-readable code.
 * Anything thrown that is not an ApiError is treated as an unexpected 500.
 */
class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new ApiError(400, code, message, details);
  }

  static validation(details, message = 'Validation failed') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(entity = 'Resource', code) {
    return new ApiError(404, code || `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, `${entity} not found`);
  }

  static conflict(code, message) {
    return new ApiError(409, code, message);
  }
}

module.exports = ApiError;
