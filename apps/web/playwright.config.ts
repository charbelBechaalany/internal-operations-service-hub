import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// apps/web/package.json sets "type": "module", so this config loads as ESM
// and has no __dirname - derive the same thing from import.meta.url instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '../api')

// A database file dedicated to this suite, never the one at
// apps/api/data/app.sqlite that a developer's own `npm run start:dev` and
// `npm run seed` write to. Kept under apps/api/data/ so it lands next to
// that file and inherits the same .gitignore rule (apps/api/data/), rather
// than introducing a second ignored path.
const testDatabasePath = path.resolve(apiDir, 'data', 'e2e.sqlite')

/**
 * How this suite gets a real API and a real, seeded database running, and
 * how it avoids depending on what a previous run left behind:
 *
 * - The `api` webServer entry below runs, in order: delete the test sqlite
 *   file, run migrations against it, run the seed script (departments,
 *   users, and one fixed request this suite never touches), then start the
 *   Nest app against that same file. So every full run of this suite starts
 *   schema-fresh and identically seeded - see apps/api/package.json's
 *   "test:e2e:server" script for the exact chain, and
 *   apps/api/scripts/reset-e2e-db.js for the delete step.
 *
 * - That reset only runs once per webServer lifetime, not once per test.
 *   Two tests sharing the seeded department/user rows is fine because those
 *   rows are static identity data nothing in this suite mutates. But the
 *   seed script also inserts one fixed request (request-it-1, Submitted) -
 *   and reseeding does NOT make that row safe to act on: reseeding runs
 *   once per suite run, while multiple tests run within that same run. A
 *   test that approved request-it-1 would leave it Approved for the very
 *   next test that expected it Submitted, with no reseed in between to fix
 *   that. So no test in this suite acts on the seeded request at all - each
 *   test calls POST /requests itself, through the real API, to mint its own
 *   request with a freshly generated id before it does anything else. That
 *   row cannot collide with any other test or any earlier run, because
 *   nothing else has ever held its id.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'npm run test:e2e:server',
      cwd: apiDir,
      url: 'http://localhost:3000/requests',
      env: { DATABASE_PATH: testDatabasePath, PORT: '3000' },
      reuseExistingServer: !process.env.CI,
      // Generous: the chain runs three separate ts-node/nest-cli cold
      // compiles in sequence (migration:run, seed, then nest start itself)
      // before the port opens, which measured over a minute even on an
      // otherwise-idle machine.
      timeout: 180_000,
    },
    {
      // Vite's dev server proxies /requests to localhost:3000 (vite.config.ts),
      // so both the browser and this config's `request` fixture - which also
      // uses baseURL - reach the real API through the same origin.
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
