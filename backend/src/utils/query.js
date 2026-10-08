/** Escapes user text so it is matched literally inside a RegExp (prevents ReDoS / regex injection). */
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsRegex(text) {
  return new RegExp(escapeRegex(text.trim()), 'i');
}

function paginationFrom(query) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  return { page, limit, skip: (page - 1) * limit };
}

function sortFrom(query, allowed, fallback) {
  const field = allowed.includes(query.sortBy) ? query.sortBy : fallback;
  const direction = query.order === 'desc' ? -1 : 1;
  return field === '_id' ? { _id: direction } : { [field]: direction, _id: 1 };
}

module.exports = { escapeRegex, containsRegex, paginationFrom, sortFrom };
