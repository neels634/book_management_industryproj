/**
 * Local development database without installing MongoDB.
 *
 * Starts a single-node MongoDB replica set (so multi-document transactions
 * work) on port 27017, storing data in backend/.data/db so it survives
 * restarts. Keep this running in its own terminal while you develop.
 *
 *   npm run db:memory
 */
const fs = require('fs');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const port = Number(process.env.DEV_DB_PORT || 27017);
const dbPath = path.resolve(__dirname, '../.data/db');

async function main() {
  fs.mkdirSync(dbPath, { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port, dbPath }],
  });
  await replSet.waitUntilRunning();

  console.log('\nMongoDB replica set is running');
  console.log(`  URI:  mongodb://127.0.0.1:${port}/book_management?replicaSet=rs0`);
  console.log(`  Data: ${dbPath}`);
  console.log('Press Ctrl+C to stop.\n');

  const stop = async () => {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('Could not start the development database:', err.message);
  process.exit(1);
});
