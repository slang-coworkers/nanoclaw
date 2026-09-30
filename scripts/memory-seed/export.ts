/**
 * Export a coworker's whole OKF memory tree as a scrubbed, integrity-checked seed.
 * What is carried and what stays behind: seed.ts and scope.ts.
 *
 * Read-only w.r.t. the source install: it only reads `groups/<folder>/memory/` and
 * only writes under --out (atomically, via a staging dir).
 *
 * Usage:
 *   tsx scripts/memory-seed/export.ts --group <folder> --out <dir> \
 *     [--groups-root groups] [--force] [--dry-run]
 */
import { exportSeed } from './seed.js';

function parseArgs(argv: string[]): {
  group: string;
  out: string;
  groupsRoot: string;
  force: boolean;
  dryRun: boolean;
} {
  const o = { group: '', out: '', groupsRoot: 'groups', force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--group') o.group = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--groups-root') o.groupsRoot = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!o.group) throw new Error('--group <folder> required');
  if (!o.out && !o.dryRun) throw new Error('--out <dir> required (or --dry-run)');
  return o;
}

const o = parseArgs(process.argv.slice(2));
const { manifest: m, seedDir } = exportSeed({ ...o, out: o.out || undefined });

const bytes = m.files.reduce((n, f) => n + f.bytes, 0);
const red = Object.values(m.redactionsByType).reduce((a, b) => a + b, 0);
const byReason: Record<string, number> = {};
for (const e of m.excluded) byReason[e.reason] = (byReason[e.reason] ?? 0) + 1;

console.log(`[export-memory-seed] group=${m.sourceGroup} scope=memory files=${m.files.length} bytes=${bytes}`);
console.log(
  `  redactions: ${red} across ${m.files.filter((f) => f.redactions > 0).length} file(s) ${JSON.stringify(m.redactionsByType)}`,
);
console.log(`  left behind (install-local): ${m.excluded.length} ${JSON.stringify(byReason)}`);
for (const e of m.excluded) console.log(`    - ${e.path} (${e.reason})`);
if (m.skipped.length) {
  console.log(`  skipped (binary — the scrubber cannot vet it): ${m.skipped.length}`);
  for (const s of m.skipped) console.log(`    - ${s.path}`);
}
console.log(
  '  NOTE: the regex scrub is best-effort — run a 2nd secret scanner + human review before committing the seed.',
);
console.log(seedDir ? `  wrote seed to ${seedDir}` : '  DRY RUN — nothing written.');
