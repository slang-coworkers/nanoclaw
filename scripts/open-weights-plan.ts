/**
 * scripts/open-weights-plan.ts — print the plan that moves every coworker to
 * open-weights models (src/open-weights-migration.ts).
 *
 * Usage (from the install's root, so .env and data/ are this install's):
 *   pnpm exec tsx scripts/open-weights-plan.ts [--db <path>]
 *
 * Read-only: it prints each group's change, the `ncl` commands that make it,
 * and what blocks a group; it changes nothing. The model settings come from
 * .env (MODEL_POLICY_ENV_KEYS), because the host receives .env through systemd
 * and a shell running this script may not have it.
 */
import { CENTRAL_DB_PATH } from '../src/config.js';
import { closeDb, initDb } from '../src/db/connection.js';
import { readEnvFile } from '../src/env.js';
import { MODEL_POLICY_ENV_KEYS, type ResolvedModels } from '../src/model-policy.js';
import { loadMigrationInputs, planGroupMigration } from '../src/open-weights-migration.js';

const dbFlag = process.argv.indexOf('--db');
const dbPath = dbFlag > 0 ? process.argv[dbFlag + 1] : CENTRAL_DB_PATH;
if (!dbPath) throw new Error('--db needs a path');
const env = { ...process.env, ...readEnvFile([...MODEL_POLICY_ENV_KEYS]) };

/** One line per role, `role=model`, with closed models marked. */
function models(resolved: ResolvedModels, closed: readonly string[]): string {
  return (['main', 'small', 'router', 'critic'] as const)
    .map((role) => `${role}=${resolved[role] ?? '-'}${closed.includes(role) ? ' (closed)' : ''}`)
    .join(', ');
}

await initDb(dbPath, { role: 'tool' });
try {
  const plans = (await loadMigrationInputs()).map((input) => planGroupMigration(input, env));
  const count = (status: string) => plans.filter((p) => p.status === status).length;
  console.log(
    `${plans.length} groups: ${count('migrate')} to migrate, ${count('already-open')} already open, ${count('blocked')} blocked\n`,
  );
  console.log('| Group | Status | Provider | Today | After |');
  console.log('|---|---|---|---|---|');
  for (const p of plans) {
    const provider = p.providerChange ? `${p.before.provider} -> ${p.providerChange}` : p.before.provider;
    console.log(
      `| ${p.folder} | ${p.status} | ${provider} | ${models(p.before, p.closedRolesBefore)} | ${models(p.after, [])} |`,
    );
  }
  const blocked = plans.filter((p) => p.blockers.length > 0);
  if (blocked.length > 0) {
    console.log('\nBlockers:');
    for (const p of blocked) for (const b of p.blockers) console.log(`- ${p.folder}: ${b}`);
  }
  console.log('\nCommands (run in this order, one group at a time):');
  for (const p of plans) if (p.commands.length > 0) console.log(`# ${p.folder}\n${p.commands.join('\n')}`);
} finally {
  await closeDb();
}
