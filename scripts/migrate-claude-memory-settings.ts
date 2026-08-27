#!/usr/bin/env tsx
/**
 * scripts/migrate-claude-memory-settings.ts — flip one EXISTING group's Claude
 * settings off native auto-memory.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-claude-memory-settings.ts --group <group-id>
 *
 * Run this from `/migrate-memory` step 3, AFTER that group's native store has
 * been staged into OKF. Flipping the switches first would strand those memories:
 * the CLI stops loading them, and the skill would then have nothing to import.
 * That ordering is also why this is not a startup migration — the skill's own
 * verification requires "no automatic migration occurred during an ordinary
 * restart".
 *
 * New groups need nothing: `group-init.ts` scaffolds the right settings.
 *
 * One group per invocation, deliberately: the skill migrates one group
 * completely before starting the next, and it has already enumerated the groups
 * with `ncl groups list`. Reading them from the central DB here would buy
 * nothing and would make a settings-file edit depend on opening (and, on a fresh
 * data dir, creating) `data/v2.db`.
 *
 * Idempotent: reports `unchanged` on a second run. A group whose provider owns
 * its own surfaces has no `.claude-shared/settings.json` and is skipped.
 */
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '../src/config.js';
import { migrateClaudeMemorySettings } from '../src/migrate-claude-memory-settings.js';

const argv = process.argv.slice(2);
const groupId = argv[argv.indexOf('--group') + 1];

if (!argv.includes('--group') || !groupId || groupId.startsWith('--')) {
  console.error('Usage: pnpm exec tsx scripts/migrate-claude-memory-settings.ts --group <group-id>');
  process.exit(2);
}

// Mirrors `claudeDir` in container-runner.ts — the per-group .claude-shared
// mounted at /home/node/.claude.
const file = path.join(DATA_DIR, 'v2-sessions', groupId, '.claude-shared', 'settings.json');

if (!fs.existsSync(file)) {
  console.log(`skipped ${groupId}: no ${path.relative(process.cwd(), file)}`);
  console.log(
    'Expected for a provider that owns its own surfaces. If this group DOES run on Claude, check the group id.',
  );
  process.exit(0);
}

if (migrateClaudeMemorySettings(file)) {
  console.log(`migrated ${groupId}`);
  console.log(`Restart it so the container picks up the new settings:\n  ncl groups restart --id ${groupId}`);
} else {
  // Either already migrated, or the file was unreadable — the function logs a
  // WARN in the latter case, so the two are distinguishable in the transcript.
  console.log(`unchanged ${groupId}`);
}
