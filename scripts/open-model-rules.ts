/**
 * scripts/open-model-rules.ts — install the open-models-only rules for every open-weights group
 * (src/open-model-rules-sync.ts).
 *
 * Usage (from the install's root, so .env and data/ are this install's):
 *   pnpm exec tsx scripts/open-model-rules.ts            list the groups; change nothing
 *   pnpm exec tsx scripts/open-model-rules.ts --apply    install or repair the rules and publish them
 *   pnpm exec tsx scripts/open-model-rules.ts --db <path>
 *
 * Needs the gateway `onecli-cost:v5` or later, and ONECLI_URL (and ONECLI_API_KEY if the gateway
 * wants one) in .env. Run it again after a group is added or moved to open weights, because the
 * host writes these rules by itself only when NANOCLAW_SESSION_PRIVILEGE=enforce. It is safe to
 * repeat: a group whose live rules are right reports `unchanged`. Exit code 1 when any group fails.
 */
import { CENTRAL_DB_PATH } from '../src/config.js';
import { closeDb, initDb } from '../src/db/connection.js';
import { readEnvFile } from '../src/env.js';
import { inferenceHostsOf, ensureOpenModelRule } from '../src/gateway-providers/onecli-model-rule.js';
import { openWeightsModelGlobs } from '../src/model-policy.js';
import { openModelRuleTargets, syncOpenModelRules } from '../src/open-model-rules-sync.js';
import { loadMigrationInputs } from '../src/open-weights-migration.js';

const apply = process.argv.includes('--apply');
const dbFlag = process.argv.indexOf('--db');
const dbPath = dbFlag > 0 ? process.argv[dbFlag + 1] : CENTRAL_DB_PATH;
if (!dbPath) throw new Error('--db needs a path');

const keys = [
  'ONECLI_URL',
  'ONECLI_API_KEY',
  'ONECLI_PROJECT_ID',
  'ANTHROPIC_BASE_URL',
  'OPENCODE_BASE_URL',
  'CODEX_BASE_URL',
  'NANOCLAW_OPEN_WEIGHTS_PREFIXES',
  'DEFAULT_AGENT_PROVIDER',
  'NANOCLAW_DEFAULT_WEIGHTS',
];
const env = { ...process.env, ...readEnvFile(keys) };
// A group with no provider or weights of its own follows the install default, which provider
// resolution reads from process.env as the host does (systemd loads .env there); a shell running
// this script may not have it.
for (const key of ['DEFAULT_AGENT_PROVIDER', 'NANOCLAW_DEFAULT_WEIGHTS']) {
  if (env[key] !== undefined) process.env[key] = env[key];
}
const hosts = inferenceHostsOf(env);
const globs = openWeightsModelGlobs(env);

await initDb(dbPath, { role: 'tool' });
let failed = 0;
try {
  const targets = openModelRuleTargets(await loadMigrationInputs(), env);
  console.log(
    `${targets.length} open-weights groups; inference hosts: ${hosts.join(', ') || '(none)'}; ${globs.length} model patterns\n`,
  );
  if (!apply) {
    for (const t of targets) console.log(`- ${t.folder} (${t.id})`);
    console.log('\nDry run. Add --apply to install or repair the rules.');
  } else {
    if (!env.ONECLI_URL) throw new Error('ONECLI_URL is not set in .env');
    const options = { baseUrl: env.ONECLI_URL, apiKey: env.ONECLI_API_KEY, projectId: env.ONECLI_PROJECT_ID };
    const results = await syncOpenModelRules(targets, (id) => ensureOpenModelRule(id, hosts, globs, options));
    for (const r of results)
      console.log(`${r.outcome.padEnd(11)} ${r.folder} (${r.id})${r.error ? ` - ${r.error}` : ''}`);
    failed = results.filter((r) => r.outcome === 'failed' || r.outcome === 'unsupported').length;
    console.log(`\n${results.length - failed} ready, ${failed} not ready`);
  }
} finally {
  await closeDb();
}
process.exit(failed > 0 ? 1 : 0);
