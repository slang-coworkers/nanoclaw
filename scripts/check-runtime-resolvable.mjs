#!/usr/bin/env node
/**
 * Assert that the deep specifiers our runtime resolves are actually resolvable
 * from this checkout's node_modules.
 *
 * WHY THIS IS NOT REDUNDANT WITH `pnpm install --frozen-lockfile`
 *
 * A green frozen install proves the lockfile agrees with the manifest. It does
 * NOT prove that the *subpath* a caller resolves exists. `createRequire().resolve
 * ('ccusage/src/cli.js')` can fail on a perfectly installed package — a new major
 * that adds an `exports` map, or moves its bin, breaks the subpath while the
 * package itself resolves fine. The dashboard treats that failure as "metric
 * unavailable" and renders an empty cost panel, so nothing goes red: the exact
 * silent-degradation shape this repo keeps getting bitten by.
 *
 * It is also the assertion that catches the composed-state defect that motivated
 * this file. `nv-dashboard` added `ccusage` to the ROOT package.json, which
 * `nv-main` owns. The two composition paths then failed in OPPOSITE directions:
 *
 *   - ci.yml canonicalizes only CONFLICTED files. package.json auto-merged
 *     (no conflict) so the dependency was admitted, while pnpm-lock.yaml DID
 *     conflict and was reset to nv-main's copy — which had no ccusage entry.
 *     Result: ERR_PNPM_OUTDATED_LOCKFILE (PR #1136).
 *   - setup/merge-train.sh canonicalizes the ENTIRE owned set after every merge,
 *     so the leaf's dependency line was discarded outright. Result: a clean
 *     install, a green deploy, and a cost panel permanently reporting
 *     "unavailable" — with nothing anywhere going red.
 *
 * The second one is why this check exists. CI failure is loud; the deploy path
 * failed silently, and only a resolution assertion can see it.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Add an entry when host or dashboard code resolves a dependency subpath at
 * runtime. Keep it to specifiers a caller actually passes to require.resolve —
 * this is a list of load-bearing entry points, not an inventory of deps.
 */
const REQUIRED = [
  {
    specifier: 'ccusage/src/cli.js',
    why: 'dashboard/server.ts resolveCcusageCli() — token-cost panel; fails closed to "metric unavailable", never to npx',
  },
];

/** Package name from a specifier: `@scope/pkg/sub` -> `@scope/pkg`, `pkg/sub` -> `pkg`. */
function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Distinguish the two failure modes, because they have different fixes and the
 * wrong diagnosis sends someone to the wrong branch:
 *
 *   MISSING  — the package is not installed at all. The manifest/lock is wrong,
 *              and the fix belongs on the branch that OWNS package.json (nv-main).
 *              A leaf branch adding a root dependency does not survive composition.
 *   SUBPATH  — the package is installed but this entry point is not reachable
 *              (exports map, renamed file, layout change). The fix is this file
 *              or the calling code, not the manifest.
 */
function classify(specifier) {
  const pkg = packageNameOf(specifier);
  const installed = fs.existsSync(path.join(repoRoot, 'node_modules', pkg));
  return installed ? 'SUBPATH' : 'MISSING';
}

let failed = 0;
for (const { specifier, why } of REQUIRED) {
  try {
    const resolved = require.resolve(specifier, { paths: [repoRoot] });
    console.log(`ok   ${specifier}\n     -> ${path.relative(repoRoot, resolved)}`);
  } catch (err) {
    failed++;
    const kind = classify(specifier);
    const pkg = packageNameOf(specifier);
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.error(`::error::runtime specifier does not resolve: ${specifier}`);
    console.error(`  consumer:  ${why}`);
    console.error(`  resolver:  ${detail}`);
    if (kind === 'MISSING') {
      console.error(
        `  diagnosis: MISSING DEPENDENCY — '${pkg}' is not installed.\n` +
          `             Add it to the branch that owns package.json (nv-main), with its\n` +
          `             lock entries. Adding it on a leaf branch does not survive\n` +
          `             composition: merge-train canonicalizes the whole owned set.`,
      );
    } else {
      console.error(
        `  diagnosis: UNEXPORTED SUBPATH — '${pkg}' IS installed, but '${specifier}'\n` +
          `             is not reachable. Likely an exports map or a moved entry point\n` +
          `             in a version bump. Fix the specifier or the calling code; the\n` +
          `             manifest and lockfile are not the problem.`,
      );
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} runtime specifier(s) unresolvable.`);
  process.exit(1);
}
console.log(`\nAll ${REQUIRED.length} runtime specifier(s) resolve.`);
