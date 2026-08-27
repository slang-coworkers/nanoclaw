/**
 * scripts/reconcile-gh-sessions.ts — CLI wrapper around `reconcileGhSessions`.
 *
 * The implementation lives in `src/reconcile-gh-sessions.ts` (so it compiles
 * into dist and can also run automatically at host startup). This file is just
 * the manual entry point.
 *
 * Usage:
 *   pnpm exec tsx scripts/reconcile-gh-sessions.ts            # dry-run
 *   pnpm exec tsx scripts/reconcile-gh-sessions.ts --apply    # perform merge
 *   pnpm exec tsx scripts/reconcile-gh-sessions.ts --apply --force-live  # skip live-session preflight (DANGEROUS)
 *
 * NANOCLAW_DATA_DIR overrides the data dir (default: repo data/).
 */
import path from 'path';

import { reconcileGhSessions } from '../src/reconcile-gh-sessions.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.NANOCLAW_DATA_DIR
  ? path.resolve(process.env.NANOCLAW_DATA_DIR)
  : path.resolve(PROJECT_ROOT, 'data');

const result = reconcileGhSessions({
  dataDir,
  apply: process.argv.includes('--apply'),
  forceLive: process.argv.includes('--force-live'),
  // eslint-disable-next-line no-console
  log: (line) => console.log(line),
});
process.exit(result.abortedLive ? 1 : 0);
