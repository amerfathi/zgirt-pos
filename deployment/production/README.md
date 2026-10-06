# Production compatibility bundle

Run `npm ci`, `npm run build`, then `node scripts/build-production-server.cjs` from a fresh committed checkout. The returned directory contains the Web build, tracked source dependencies, API handlers and Wrangler configuration. It never reads the old ignored staging checkout and never applies migrations.

Three explicitly tracked handler overrides preserve the existing production behavior without the unapplied cash/timezone schema dependencies. Cash routes and their signing/device helper modules are omitted. The current middleware's explicit disabled-cash guard is retained as an additional defense. Do not set CASH_SHIFTS_ENABLED for this bundle.

The file-hash manifest records the Git HEAD but is not proof of a clean checkout; release operators must require `git status --porcelain` to be empty. Build and test the bundle before deployment. This recipe alone is not proof of a live redeployment or completion of drawer closing.

When the cash feature is completed, audited migrations and compatibility overrides must be deliberately revised together; changes to the main push handler do not automatically replace its production override.
