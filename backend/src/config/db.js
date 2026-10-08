const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Unknown filter paths are dropped instead of silently matching everything.
mongoose.set('strictQuery', true);

let transactionSupport = null;

async function connectDatabase(uri, options = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...options });
  // Register every model, then make sure collections and indexes (unique ISBN,
  // memberId, username, ...) exist before the first request or transaction.
  require('../models');
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  transactionSupport = null;
  logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

/**
 * Multi-document transactions need a replica set or sharded cluster.
 * The result is cached per connection.
 */
async function supportsTransactions() {
  if (transactionSupport !== null) return transactionSupport;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch (err) {
    transactionSupport = false;
  }
  if (!transactionSupport) {
    logger.warn(
      'MongoDB is a standalone server: multi-document transactions are unavailable. ' +
        'Inventory updates fall back to atomic conditional writes with compensation. ' +
        'Use a replica set (npm run db:memory, or Atlas) for full ACID guarantees.'
    );
  }
  return transactionSupport;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  transactionSupport = null;
}

module.exports = { connectDatabase, disconnectDatabase, supportsTransactions };
