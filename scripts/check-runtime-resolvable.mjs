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
 * Is the package on disk anywhere Node would look, walking node_modules dirs up
 * from the resolution root? Deliberately a LAST RESORT, not the primary test —
 * see classify().
 */
function foundOnDisk(pkg) {
  const exists = (p) => {
    try {
      // realpathSync, because pnpm LINKS direct deps into the root node_modules
      // and a dangling link must not read as "present".
      fs.statSync(fs.realpathSync(p));
      return true;
    } catch {
      return false;
    }
  };

  // pnpm encodes a scoped name in the virtual store by replacing `/` with `+`:
  // `@scope/pkg` lives at `.pnpm/@scope+pkg@<version>/node_modules/@scope/pkg`.
  const storePrefix = `${pkg.replace('/', '+')}@`;

  let dir = repoRoot;
  for (;;) {
    const nm = path.join(dir, 'node_modules');

    // Hoisted layouts (npm, yarn, and pnpm's DIRECT dependency links).
    if (exists(path.join(nm, pkg, 'package.json'))) return true;

    // pnpm's virtual store. A transitive dependency is NEVER linked at the root
    // under isolated node_modules — it only exists here. Checking just the line
    // above is how the first version of this function reported a perfectly
    // installed transitive package as "not installed".
    try {
      for (const entry of fs.readdirSync(path.join(nm, '.pnpm'))) {
        if (!entry.startsWith(storePrefix)) continue;
        if (exists(path.join(nm, '.pnpm', entry, 'node_modules', pkg, 'package.json'))) return true;
      }
    } catch {
      // no .pnpm store at this level
    }

    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/**
 * Three outcomes, because they have three different fixes and the wrong
 * diagnosis sends someone to the wrong branch entirely.
 *
 *   MISSING     — not resolvable and not on disk. The manifest/lock is wrong and
 *                 the fix belongs on the branch that OWNS package.json (nv-main);
 *                 a leaf branch adding a root dependency does not survive
 *                 composition.
 *   UNREACHABLE — on disk, but the package itself does not resolve from our root.
 *                 Under pnpm's isolated layout only DIRECT dependencies are
 *                 linked into the root node_modules, so this is the signature of
 *                 relying on something transitive. Declare it directly.
 *   SUBPATH     — the package resolves; this entry point does not. An exports map
 *                 or a moved file. Fix the specifier or the caller — the manifest
 *                 and lockfile are innocent.
 *
 * The package probe uses `paths: [repoRoot]`, the SAME resolution root as the
 * real check above. An earlier version probed the filesystem at a hardcoded
 * node_modules path, which disagreed with the resolver for scoped packages,
 * dangling links, and anything not hoisted — i.e. it could confidently print the
 * wrong instruction.
 */
function classify(specifier) {
  const pkg = packageNameOf(specifier);
  // `./package.json` is exported by most packages; a bare specifier covers those
  // that block it but declare a main/exports entry. Either proves reachability.
  for (const probe of [`${pkg}/package.json`, pkg]) {
    try {
      require.resolve(probe, { paths: [repoRoot] });
      return 'SUBPATH';
    } catch {
      // try the next probe
    }
  }
  return foundOnDisk(pkg) ? 'UNREACHABLE' : 'MISSING';
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
    } else if (kind === 'UNREACHABLE') {
      console.error(
        `  diagnosis: UNDECLARED TRANSITIVE — '${pkg}' exists on disk but does not\n` +
          `             resolve from the repo root. pnpm links only DIRECT dependencies\n` +
          `             into the root node_modules, so this code is leaning on something\n` +
          `             it never declared. Add '${pkg}' to package.json on nv-main.`,
      );
    } else {
      console.error(
        `  diagnosis: UNEXPORTED SUBPATH — '${pkg}' resolves, but '${specifier}' does\n` +
          `             not. Likely an exports map or a moved entry point in a version\n` +
          `             bump. Fix the specifier or the calling code; the manifest and\n` +
          `             lockfile are not the problem.`,
      );
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} runtime specifier(s) unresolvable.`);
  process.exit(1);
}
console.log(`\nAll ${REQUIRED.length} runtime specifier(s) resolve.`);
