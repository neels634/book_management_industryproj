/**
 * NoSQL-injection guard: removes any object key that starts with "$" or
 * contains "." from body, query and params (e.g. {"username": {"$ne": ""}}).
 * Validation then rejects the remaining wrong-typed values.
 */
function scrub(value) {
  if (Array.isArray(value)) {
    value.forEach(scrub);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else scrub(value[key]);
    }
  }
  return value;
}

function sanitizeRequest(req, res, next) {
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
}

module.exports = { sanitizeRequest, scrub };
