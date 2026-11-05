/**
 * Import a scrubbed, integrity-checked memory seed into a coworker's
 * `groups/<folder>/memory/`, at the same relative paths it was exported from.
 *
 * Explicit and opt-in: a template stamp gives a coworker fresh memory; this lays
 * prior learnings into it only when chosen. The whole seed is verified against its
 * manifest (bytes, SHA-256, no undeclared/unsafe/install-local paths, re-scrub
 * clean) before anything is written. A target file that differs from the seed is a
 * conflict — nothing is written unless --force — except a file that is still the
 * pristine runtime scaffold, which the seed's evolved version replaces.
 *
 * On Astra, point --groups-root at the router's persistent groups dir
 * (`/app/data/groups`).
 *
 * Usage:
 *   tsx scripts/memory-seed/import.ts --group <folder> --seed <dir> \
 *     [--groups-root groups] [--force] [--allow-empty] [--dry-run] [--scaffold-dir <dir>]
 */
import { importSeed, SeedConflictError } from './seed.js';

function parseArgs(argv: string[]) {
  const o = {
    group: '',
    seed: '',
    groupsRoot: 'groups',
    force: false,
    allowEmpty: false,
    dryRun: false,
    scaffoldDir: undefined as string | undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--group') o.group = argv[++i];
    else if (a === '--seed') o.seed = argv[++i];
    else if (a === '--groups-root') o.groupsRoot = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--allow-empty') o.allowEmpty = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--scaffold-dir') o.scaffoldDir = argv[++i];
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!o.group) throw new Error('--group <folder> required');
  if (!o.seed) throw new Error('--seed <dir> required');
  return o;
}

const o = parseArgs(process.argv.slice(2));
try {
  const r = importSeed(o);
  console.log(`[import-memory-seed] group=${o.group} from=${r.sourceGroup} seed=${r.seedDir} declared=${r.declared}`);
  console.log(
    `  write=${r.write.length} skip-identical=${r.skippedIdentical.length} ` +
      `replace-pristine-scaffold=${r.replacedScaffold.length} force-overwritten=${r.overwritten.length}`,
  );
  console.log(
    r.applied ? `  wrote into ${o.groupsRoot}/${o.group}/memory` : '  DRY RUN — seed validated, nothing written.',
  );
} catch (e) {
  if (e instanceof SeedConflictError) {
    console.error(`[import-memory-seed] ${e.message}`);
    process.exit(2);
  }
  throw e;
}
