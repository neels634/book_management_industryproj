const mongoose = require('mongoose');
const { supportsTransactions } = require('../config/db');
const logger = require('../utils/logger');

const TXN_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

/**
 * Runs `work(ctx)` so that its writes either all happen or none do.
 *
 * - Replica set / Atlas: a real MongoDB multi-document transaction. Write
 *   conflicts from concurrent requests are retried automatically by
 *   session.withTransaction().
 * - Standalone mongod (no transactions): every write in the services is an
 *   atomic conditional update, and each registers an undo step with
 *   ctx.onRollback(). If a later step fails, the undo steps run in reverse.
 *
 * Services must pass ctx.session to every query and register an undo step
 * after every write.
 */
async function runInTransaction(work) {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work({ session, onRollback: () => {} });
      }, TXN_OPTIONS);
      return result;
    } finally {
      await session.endSession();
    }
  }

  const undo = [];
  try {
    return await work({ session: null, onRollback: (fn) => undo.push(fn) });
  } catch (err) {
    for (const step of undo.reverse()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await step();
      } catch (undoErr) {
        logger.error('Compensating update failed - manual inventory check required', undoErr);
      }
    }
    throw err;
  }
}

module.exports = { runInTransaction };
