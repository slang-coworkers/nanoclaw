#!/usr/bin/env node
/**
 * Assert that the deep specifiers our runtime resolves are (a) resolvable from
 * THIS checkout, and (b) actually runnable.
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
 *     Result: ERR_PNPM_OUTDATED_LOCKFILE (PR #1136). Loud.
 *   - setup/merge-train.sh canonicalizes the ENTIRE owned set after every merge,
 *     so the leaf's dependency line was discarded outright. Result: a clean
 *     install, a green deploy, and a cost panel permanently reporting
 *     "unavailable" — with nothing anywhere going red. Silent, and it is the
 *     deploy path. That is why this runs from merge-train and compose-check,
 *     not only from the pull-request workflow.
 *
 * THREE THINGS THIS CHECKS, IN ORDER. Each exists because the previous one can
 * pass while the system is still broken:
 *
 *   1. RESOLVES     — the specifier resolves at all.
 *   2. IS OURS      — it resolves to something inside THIS checkout's
 *                     node_modules. `require.resolve(..., { paths: [root] })`
 *                     walks node_modules directories ABOVE `root` and consults
 *                     global folders, so without this a package the checkout
 *                     never installed can satisfy the check from a parent or
 *                     global install. That is a false green in the one gate
 *                     whose job is catching false greens.
 *   3. RUNS         — for entries declaring `smoke`, the thing actually executes.
 *                     ccusage's cli.js is a launcher that spawns a platform-
 *                     native binary from an OPTIONAL dependency; resolution
 *                     succeeds even when that binary is absent, and the dashboard
 *                     then receives an empty result silently.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ownModules = path.join(repoRoot, 'node_modules');

/**
 * Add an entry when host or dashboard code resolves a dependency subpath at
 * runtime. Keep it to specifiers a caller actually passes to require.resolve —
 * this is a list of load-bearing entry points, not an inventory of deps.
 *
 * `smoke`: argv passed to `node <resolved>`; must exit 0. Declare it when
 * resolution alone does not prove the seam works (native binaries, launchers).
 */
const REQUIRED = [
  {
    specifier: 'ccusage/src/cli.js',
    why: 'dashboard/server.ts resolveCcusageCli() — token-cost panel; fails closed to "metric unavailable", never to npx',
    smoke: ['--version'],
  },
];

const SMOKE_TIMEOUT_MS = 60_000;

/** Package name from a specifier: `@scope/pkg/sub` -> `@scope/pkg`, `pkg/sub` -> `pkg`. */
function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function realpathOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** Is `resolved` inside this checkout's own node_modules? Compared via realpath,
 *  because pnpm resolves through symlinks into `.pnpm/`, which is still ours. */
function isOurs(resolved) {
  const real = realpathOrNull(resolved);
  const mine = realpathOrNull(ownModules);
  if (!real || !mine) return false;
  return real === mine || real.startsWith(mine + path.sep);
}

/** Resolve, but only accept a result that lives in this checkout. */
function resolveOurs(request) {
  const resolved = require.resolve(request, { paths: [repoRoot] });
  if (!isOurs(resolved)) {
    const err = new Error(`resolved outside this checkout: ${resolved}`);
    err.code = 'NV_OUTSIDE_CHECKOUT';
    err.resolved = resolved;
    throw err;
  }
  return resolved;
}

/**
 * Is the package on disk anywhere Node (or pnpm) would keep it? A LAST RESORT,
 * used only to tell two different "not resolvable" causes apart.
 */
function foundOnDisk(pkg) {
  // pnpm encodes a scoped name in the virtual store by replacing `/` with `+`:
  // `@scope/pkg` lives at `.pnpm/@scope+pkg@<version>/node_modules/@scope/pkg`.
  const storePrefix = `${pkg.replace('/', '+')}@`;
  let dir = repoRoot;
  for (;;) {
    const nm = path.join(dir, 'node_modules');
    // Hoisted layouts (npm, yarn, and pnpm's DIRECT dependency links).
    if (realpathOrNull(path.join(nm, pkg, 'package.json'))) return true;
    // pnpm's virtual store. A TRANSITIVE dependency is never linked at the root
    // under isolated node_modules — it only exists here. Checking just the line
    // above is how an earlier version of this function reported a fully
    // installed transitive package as "not installed".
    try {
      for (const entry of fs.readdirSync(path.join(nm, '.pnpm'))) {
        if (!entry.startsWith(storePrefix)) continue;
        if (realpathOrNull(path.join(nm, '.pnpm', entry, 'node_modules', pkg, 'package.json'))) {
          return true;
        }
      }
    } catch {
      // no .pnpm store at this level
    }
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/** A link that exists but points nowhere means a damaged install, not a missing
 *  dependency — and those have completely different fixes. */
function hasDanglingLink(pkg) {
  const link = path.join(ownModules, pkg);
  try {
    fs.lstatSync(link);
  } catch {
    return false; // nothing there at all
  }
  return realpathOrNull(link) === null;
}

/**
 * Five outcomes, because they have five different fixes and the wrong diagnosis
 * sends someone to the wrong branch entirely.
 *
 *   OUTSIDE      resolves, but from a parent/global install — this checkout does
 *                not actually have it. Would have been a false green.
 *   CORRUPT      dangling link or unreadable package metadata. Reinstall; the
 *                manifest is fine.
 *   MISSING      not resolvable, not on disk -> manifest/lock, fix on nv-main.
 *   UNREACHABLE  on disk but not resolvable from our root. Under pnpm only DIRECT
 *                dependencies are linked at the root, so this is the signature of
 *                relying on something transitive. Declare it.
 *   SUBPATH      package resolves, this entry point does not -> exports map or a
 *                moved file. The manifest and lockfile are innocent.
 */
function classify(specifier, err) {
  if (err?.code === 'NV_OUTSIDE_CHECKOUT') return 'OUTSIDE';
  if (err?.code === 'ERR_INVALID_PACKAGE_CONFIG') return 'CORRUPT';
  if (err?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return 'SUBPATH';

  const pkg = packageNameOf(specifier);
  if (hasDanglingLink(pkg)) return 'CORRUPT';

  // Can the PACKAGE ITSELF be reached from our root, and is it ours?
  // `./package.json` is exported by most packages; a bare specifier covers those
  // that block it but declare a main/exports entry. Either proves reachability.
  for (const probe of [`${pkg}/package.json`, pkg]) {
    try {
      resolveOurs(probe);
      return 'SUBPATH';
    } catch (probeErr) {
      if (probeErr?.code === 'ERR_INVALID_PACKAGE_CONFIG') return 'CORRUPT';
      // otherwise try the next probe
    }
  }
  return foundOnDisk(pkg) ? 'UNREACHABLE' : 'MISSING';
}

const ADVICE = {
  OUTSIDE: (pkg, spec, err) =>
    `RESOLVED OUTSIDE THIS CHECKOUT — '${spec}' was satisfied by\n` +
    `             ${err.resolved}\n` +
    `             which is not under ${ownModules}. This checkout did not install\n` +
    `             '${pkg}'; a parent or global install masked it. Add it to\n` +
    `             package.json on nv-main. Without this assertion the gate would\n` +
    `             have passed while production had nothing.`,
  CORRUPT: (pkg) =>
    `DAMAGED INSTALL — '${pkg}' is present but its link or metadata is\n` +
    `             unreadable. Re-run \`pnpm install --frozen-lockfile\`. The\n` +
    `             manifest and lockfile are not the problem.`,
  MISSING: (pkg) =>
    `MISSING DEPENDENCY — '${pkg}' is not installed.\n` +
    `             Add it to the branch that owns package.json (nv-main), with its\n` +
    `             lock entries. Adding it on a leaf branch does not survive\n` +
    `             composition: merge-train canonicalizes the whole owned set.`,
  UNREACHABLE: (pkg) =>
    `UNDECLARED TRANSITIVE — '${pkg}' exists on disk but does not\n` +
    `             resolve from the repo root. pnpm links only DIRECT dependencies\n` +
    `             into the root node_modules, so this code is leaning on something\n` +
    `             it never declared. Add '${pkg}' to package.json on nv-main.`,
  SUBPATH: (pkg, spec) =>
    `UNEXPORTED SUBPATH — '${pkg}' resolves, but '${spec}' does not.\n` +
    `             Likely an exports map or a moved entry point in a version bump.\n` +
    `             Fix the specifier or the calling code; the manifest and lockfile\n` +
    `             are not the problem.`,
};

let failed = 0;
function fail(specifier, why, detail, advice) {
  failed++;
  console.error(`::error::${specifier}`);
  console.error(`  consumer:  ${why}`);
  console.error(`  detail:    ${detail}`);
  console.error(`  diagnosis: ${advice}`);
}

for (const { specifier, why, smoke } of REQUIRED) {
  const pkg = packageNameOf(specifier);
  let resolved;
  try {
    resolved = resolveOurs(specifier);
  } catch (err) {
    const kind = classify(specifier, err);
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    fail(specifier, why, detail, ADVICE[kind](pkg, specifier, err));
    continue;
  }

  console.log(`ok   ${specifier}\n     -> ${path.relative(repoRoot, resolved)}`);

  if (!smoke) continue;
  try {
    execFileSync(process.execPath, [resolved, ...smoke], {
      timeout: SMOKE_TIMEOUT_MS,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log(`     smoke: node <cli> ${smoke.join(' ')} -> exit 0`);
  } catch (err) {
    const detail = err?.stderr?.toString().split('\n')[0] || err?.message?.split('\n')[0] || String(err);
    fail(
      specifier,
      why,
      detail,
      `RESOLVES BUT DOES NOT RUN — \`node <cli> ${smoke.join(' ')}\` failed.\n` +
        `             '${pkg}' resolves, so the manifest and lockfile are fine. Its\n` +
        `             launcher spawns a platform-native binary from an OPTIONAL\n` +
        `             dependency; when that is absent or unusable the caller gets an\n` +
        `             empty result and reports nothing wrong. Check that the\n` +
        `             @${pkg}/${pkg}-<platform>-<arch> optional package installed.`,
    );
  }
}

if (failed > 0) {
  console.error(`\n${failed} runtime specifier(s) failed.`);
  // exitCode, not process.exit(): an immediate exit can truncate piped stderr,
  // and the diagnostics above are the entire point of this script.
  process.exitCode = 1;
} else {
  console.log(`\nAll ${REQUIRED.length} runtime specifier(s) resolve, belong to this checkout, and run.`);
}
