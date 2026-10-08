const { MongoMemoryReplSet } = require('mongodb-memory-server');

/** One real MongoDB replica set for the whole test run (transactions enabled). */
module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await replSet.waitUntilRunning();
  global.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();
};
