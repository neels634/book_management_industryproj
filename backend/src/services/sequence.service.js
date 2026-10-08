const { Counter } = require('../models');

const FORMATS = {
  book: { prefix: 'BK', width: 5 },
  member: { prefix: 'MEM', width: 5 },
  transaction: { prefix: 'TXN', width: 6 },
};

/**
 * Atomically reserves the next human-readable id, e.g. "BK-00042".
 * Called outside of multi-document transactions on purpose: a single hot
 * counter document inside every loan transaction would serialise all loans.
 * A rolled-back loan therefore leaves a gap in the sequence, which is fine.
 */
async function nextId(type) {
  const format = FORMATS[type];
  if (!format) throw new Error(`Unknown sequence type: ${type}`);
  const counter = await Counter.findOneAndUpdate(
    { _id: type },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${format.prefix}-${String(counter.seq).padStart(format.width, '0')}`;
}

/** Moves a sequence forward to at least `value` (used by the seed script). */
async function ensureAtLeast(type, value) {
  await Counter.updateOne({ _id: type }, { $max: { seq: value } }, { upsert: true });
}

module.exports = { nextId, ensureAtLeast, FORMATS };
