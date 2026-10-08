const ApiError = require('../utils/ApiError');

/** Query strings like ?category=&q= arrive as empty strings; treat them as absent. */
function dropEmpty(query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined));
}

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and coerces req.params / req.query / req.body against zod schemas.
 * Parsed output replaces the raw input, so unknown fields are stripped and
 * controllers only ever see whitelisted, typed values (no mass assignment).
 */
const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const input = part === 'query' ? dropEmpty(req.query) : req[part] ?? {};
    const result = schema.safeParse(input);
    if (!result.success) return next(ApiError.validation(formatIssues(result.error.issues)));
    req[part] = result.data;
  }
  return next();
};

module.exports = validate;
