const { rmSync } = require('node:fs');

// Deletes the sqlite file the E2E run is about to rebuild via migration:run
// + seed. DATABASE_PATH is required rather than defaulted, so a caller that
// forgets to set it gets a clear failure instead of silently deleting (or
// migrating into) the developer's own apps/api/data/app.sqlite.
const databasePath = process.env.DATABASE_PATH;
if (!databasePath) {
  throw new Error('DATABASE_PATH must be set before resetting the E2E database.');
}

// force: true makes a missing file a no-op instead of an error - the normal
// case on a first run, or after someone already cleaned the file up.
rmSync(databasePath, { force: true });
