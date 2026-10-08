/**
 * Every successful response has the shape:
 *   { success: true, message?, data, meta? }
 * Errors (see middleware/errorHandler) have the shape:
 *   { success: false, error: { code, message, details? } }
 */
function sendSuccess(res, { statusCode = 200, data = null, message, meta } = {}) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function sendCreated(res, data, message) {
  return sendSuccess(res, { statusCode: 201, data, message });
}

function sendPaginated(res, { items, total, page, limit }, extraMeta = {}) {
  return sendSuccess(res, {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      ...extraMeta,
    },
  });
}

module.exports = { sendSuccess, sendCreated, sendPaginated };
