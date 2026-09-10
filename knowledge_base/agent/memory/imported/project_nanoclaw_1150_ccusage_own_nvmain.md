---
name: project_nanoclaw_1150_ccusage_own_nvmain
description: "nanoclaw#1150 own ccusage on nv-main + runtime-resolvable guard. R1 f08f02e1: fixed my #1122 red-1; my red = guard placed only in ci.yml. R2 b451aa7e: red+both yellow RESOLVED (+merge-train rollback, +OUTSIDE class I missed); new red = Node-20 err.code undefined. R3 b10b7ea3: blocker CLOSED, CI GREEN (2262 passed); 2 yellow = comment states a FALSE mechanism, and a BOM manifest makes the post-resolve block fail a healthy install. R4 663f7235: CI green; fixes an ENOENT hole I missed; 3 yellow (2 carried + summary asserts skipped smoke). Comments 5230921344, 5231002917, 5231072274, 5231218120."
metadata:
  node_type: memory
  type: project
  originSessionId: a5b972af-7843-4f33-bba2-5d5f162f197f
---

# `slang-coworkers/nanoclaw#1150` — "deps: own ccusage on nv-main, and assert runtime specifiers actually resolve"

Author **szihs**, base **`nv-main`**, branch `fix/nv-main/ccusage-composed-lock`. Reviewed at **`f08f02e1`** (R1) then **`b451aa7e`** (R2, `synchronize`).
R1 of the 2026-08-07 production NO-GO remediation. Handled **INLINE by Main** per the standing repo
rule (nanoclaw-platform fork, no nanoclaw approver wired; the webhook's generic
"route to `*-pr-approver`" string is overridden). ~29th routing instance.
See [[project_nanoclaw_pr874_webhook_route_approver]].

**Direct follow-up to my own #1122 🔴1** — its recorded RESUME trigger was literally *"a follow-up
declaring ccusage on nv-main lands ⇒ recheck whether the composed tree installs it, with a
named-package positive control."* ⭐⭐**A pre-registered prediction turned this from a fresh read into
a test.** OPEN at review time, CI **4/4 green**, **no prior reviews** (I was first).
Comment **`5230921344`**. 4 files, +193/-0, merge-base == base tip (no rebase skew).

## ✅ The core fix is CORRECT — verified by executing the sweep, not by reading the diff

Reproduced `merge-train.sh:108-113` verbatim on a real `nv-dashboard` checkout, `origin/nv-main`
swapped as the **only** variable:

| `nv-main` under test | owned swept | manifest `ccusage` | lock `ccusage` |
|---|---|---|---|
| base `8d108b2f` | 455 | **0** | **0** |
| PR `f08f02e1` | 456 | **1** | **21** |

Before-row **independently reproduces #1122 🔴1**; after-row shows survival. Controls:
`dashboard/server.ts` present at blob **`9b177602`** (same blob as #1122, re-checked *after* the
sweep as a presence control) + `better-sqlite3`=2 in both rows. Composed tree:
`pnpm install --frozen-lockfile` green, guard resolves to
`node_modules/.pnpm/ccusage@20.0.19/node_modules/ccusage/src/cli.js`, CLI runs (rc=0, real JSON).
Registry-checked (not taken): published **2026-07-27** (13 d > 3-d gate), only script is `build`
(**no** install lifecycle hook), `exports: null`, `bin: ./src/cli.js`, all six optional natives
`scripts: {}` ⇒ no `minimumReleaseAgeExclude`, no `onlyBuiltDependencies`. All as claimed.

Guard sensitivity — **all 3 claimed states confirmed by execution**, healthy re-run as control each
time: healthy → `ok` rc=0 · package hidden → `MISSING DEPENDENCY` rc=1 · only `src/cli.js` hidden →
`UNEXPORTED SUBPATH` rc=1. Both diagnoses correctly classified. Also fires on the real defect shape
(strip manifest line + reinstall → rc=1, MISSING, names nv-main).

## 🔴 The guard is absent from the one path whose failure is SILENT — the path it was written for

The PR's whole rationale is loud-`ci.yml` vs silent-`merge-train`, "only a resolution assertion
catches the silent one" — then adds the assertion **only to `ci.yml`**. Measured over
`.github/workflows/`: reference `merge-train` = `ci.yml` + **`compose-check.yml`**; run
`check:runtime-deps` = **`ci.yml` only** (`compose-check.yml` 0 hits, control `frozen-lockfile` 2).
`compose-check.yml`'s own header calls its tree *"the deploy compose onto nv-coworkers … not the
nv-main-based fan-merge in ci.yml"* and warns *"a green ci.yml does NOT prove the shipped tree
builds"* — it installs/builds/typechecks/tests without ever asserting resolvability.

⭐⭐⭐**Second, sharper leg — `ownership.py:41-52` already documents the mechanism: `ci.yml` is the
one nv-main-owned file that CANNOT COMPOSE ITSELF** (Actions reads the workflow before the compose
step runs), so a leaf PR runs **its own** `ci.yml`. **Confirmed by natural experiment on an EXISTING
step**, not by assertion: `check-release-age-policy` lives only on nv-main's copy, and PR #1122
(base `nv-dashboard`) ran 19 steps with **no** release-age and **no** typecheck-gate step —
`setup-bun` straight to `pnpm install`. Per-branch census: `runtime-deps=0` on all five leaves,
`check-release-age-policy` present only on nv-main (control). ⇒ a future leaf re-committing the
#1122 mistake still goes green. FIX = one line in `compose-check.yml` (push-triggered on the
composed tree, so it sidesteps self-composition entirely).

## 🟡 Guard cannot see the mode that produced the silent `$0.00` (#1122 🔴2)

Resolution and **execution** are two different success conditions: the package resolves from
`src/cli.js` while the native binary is a separate platform-specific **optional** dep. Constructed
(remove only `node_modules/@ccusage`, keep `ccusage` as control): **guard `ok` rc=0** while
**CLI rc=1** `native binary is not available for linux-x64` ⇒ `runCcusage` `err` branch → `[]` →
uncaveated `$0.00`. ⚠️**Scope bounded honestly, and this bounding is what keeps it 🟡:** on a normal
linux-x64 pnpm install the native dep IS present (`node_modules/.pnpm/@ccusage+ccusage-linux-x64@20.0.19`
verified in the composed tree) ⇒ coverage gap, **not a live break**. A `--version` spawn assertion
closes it. #1122 🔴2 still LIVE on `nv-dashboard` (`ccusageUnavailableReason` set only on resolve path).

## 🟡 No test on the new script

`grep -c ccusage` over `dashboard/*.test.ts` → **0** (control `api/state` → 9). Untested part that
matters: `classify()` uses `node_modules/<pkg>` existence — a **different oracle** from
`require.resolve`, so store-but-not-linked classifies `MISSING` when the real cause is linkage. Hit
that shape in the composed tree (resolution via `.pnpm/…`); it worked, nothing pins it.

## Adjacent, PRE-EXISTING (not charged)

Full deploy-compose replay aborts at a delete/modify conflict on
`.claude/skills/add-dashboard/resources/dashboard-pusher.ts`: `merge-train.sh:88-94` handles the
missing blob, but `git add -A -- <path>` then fatals `pathspec … did not match any files`, killing
the run. **Byte-identical logs before and after** ⇒ pre-existing, outside scope. It is *why* I
isolated the single-overlay sweep instead of publishing a whole-train number.

## ⛔ My own instrument failures — both failed TOWARD the PR's favor, both caught by controls

1. ⭐⭐⭐First whole-train replay returned `manifest=1 lock=21` (**agreeing with the PR**) from a run
   where `dashboard/server.ts` was **ABSENT** and `rc=128` — **a count over a set that was never
   composed** (same shape as #1122 instrument-failure #2). Discarded; re-ran with the presence
   control asserted *before* any count.
2. ⛔`node … | grep -v UNDICI; echo rc=$?` printed **rc=0** for a run that genuinely exits 1 —
   `$?` read `grep`. Same false-exit-status trap as #1102. Re-measured with file redirection →
   true **rc=1**. Every exit status published came from an unpiped invocation.
3. Earlier harness attempts died `fatal: couldn't find remote ref nv-main` / stale bare clone; fixed
   by fetching real heads from GitHub and **verifying all 6 against the API** before use.

⇒ ⭐⭐**Published only what a control could have contradicted. I explicitly did NOT confirm the PR's
`BEFORE ciyml manifest=1 lock=0` row** (my ci.yml-path replays aborted pre-existing) and said so
rather than implying verification — see [[feedback_published_negative_env_claims_need_rederivation]].

## 2026-08-09 `synchronize` → head `b451aa7e` (2 commits): my 🔴 + both 🟡 RESOLVED, new 🔴 from CI

⭐⭐**Re-measured everything rather than carrying the verdict — the #1102 rule (a `synchronize` can fix
the only blocker mid-review) paid off in the FIX direction this time.** Comment **`5231002917`**.

- ✅**My 🔴 (placement) resolved, and OVER-delivered.** Re-ran the same exposed-vs-protected greps:
  set difference now **empty** (both `ci.yml` + `compose-check.yml`; control `frozen-lockfile`=3).
  Beyond the ask: `merge-train.sh:131-148` runs the check **inside install→build under
  `rollback_and_fail`** ⇒ fires on the operator's real `setup` path, and a stripped dep **rolls the
  merge back** instead of shipping green.
- ✅**🟡 smoke (resolution≠execution) closed** — reconstructed the #1122 🔴2 state (remove only
  `node_modules/@ccusage`, keep `ccusage` as control): `f08f02e1` rc=0 `ok` → `b451aa7e` rc=1
  `RESOLVES BUT DOES NOT RUN`.
- ✅**🟡 two-oracle `classify()` closed** — genuine pnpm transitive (`ansi-styles` under `chalk`, in
  `.pnpm/` not root-linked) → `UNDECLARED TRANSITIVE`, direct dep `chalk` `ok` as control.
- ⭐⭐⭐**`OUTSIDE` — a false-green class THE AUTHOR found and I MISSED.** `require.resolve` walks
  node_modules ABOVE the root, so a parent install satisfies a package the checkout never installed.
  Same tree, both versions: `f08f02e1` → **rc=0** `-> ../node_modules/ccusage/...`; `b451aa7e` → rc=1
  `RESOLVED OUTSIDE THIS CHECKOUT`. **The gate whose job is catching false greens had its own.**
  ⇒ my placement audit found WHERE it runs; it never asked WHAT could satisfy it.
- ✅**Test file non-vacuous BY REVERT DRILL** (not by trusting 9 green): revert only the `.mjs` to
  `f08f02e1`, keep new tests → **7 of 9 FAIL**; restore → 9/9. `scripts/**/*.test.ts` is in
  `vitest.config.ts:12` so they really run.

### 🔴 NEW — CI red: Node-20 `code=undefined` mis-diagnoses a corrupt install

`Host tests` **1 failed / 161 passed**: `reports DAMAGED INSTALL when package metadata is unparseable`.
⭐⭐⭐**It passed 9/9 on MY edge ⇒ MY GREEN was the environment-specific claim, not CI's red** — the
inverse of ANCHOR C, and the reason I probed instead of relaying. My node **v22.23.1**, CI pins
**Node 20** (`compose-check.yml:53`). Probed a real `20.20.2` interpreter (`npx -y node@20`), not inferred:

| Node | `err.code` | message |
|---|---|---|
| 22.23.1 | `ERR_INVALID_PACKAGE_CONFIG` | `Invalid package config …` |
| **20.20.2** | **`undefined`** | `Error parsing …: Expected propert…` |

`classify()` keys on that code at two sites ⇒ branch never fires on 20. Real script vs corrupt
manifest: node22 → `DAMAGED INSTALL` (test's expectation), **node20 → `UNDECLARED TRANSITIVE`** ⇒
**on the SHIPPED runtime a damaged install is told "add it to package.json on nv-main" when the fix is
a reinstall** — exactly the wrong-branch outcome the 5-way classifier exists to prevent. ⇒ the failing
test reports a REAL defect, it is not too strict. FIX = match message too:
`e?.code==='ERR_INVALID_PACKAGE_CONFIG' || /Error parsing .*package\.json/.test(e?.message??'')`.
`hasDanglingLink` unaffected (uses `realpath`).

### ⚠️ Scoped to MY environment, NOT charged

Smoke-failure `detail:` line showed a UNDICI proxy warning instead of the real error
(`.split('\n')[0]` takes the first stderr line). Traced to **`NODE_USE_ENV_PROXY=1` in my own
container** (OneCLI proxy) — with warnings suppressed it reads correctly. CI has no such var.
⭐⭐**Published as "my edge, not charging it" + a cosmetic robustness note (scan last non-empty line),
per ANCHOR C: a true statement about my environment is not a fact about the tool.**

## 2026-08-09 `synchronize` → head `b10b7ea3` (R3, 1 commit): R2 blocker CLOSED on the shipped runtime

Comment **`5231072274`**. Fix parses the manifest **itself** instead of trusting `err.code` — removes
the version dependence entirely, **better than my suggested message-regex** (which would have been a
third dialect of "what does this Node call a bad manifest").

✅**Two guards against repeating R2's mistake, both load-bearing:**
- **Test file BYTE-IDENTICAL to R2** (`8f36911df813` at both heads) ⇒ the expectation was NOT relaxed
  to meet the impl; the impl moved. ⭐⭐**Cheap and decisive: hash the test file across heads before
  crediting a newly-green suite.**
- **Verified on a REAL `npx -y node@20` (v20.20.2), never on my v22:**

| | R2 `b451aa7e` | R3 `b10b7ea3` |
|---|---|---|
| corrupt manifest, node 22 | `DAMAGED INSTALL` | `DAMAGED INSTALL` |
| corrupt manifest, **node 20** | **`UNDECLARED TRANSITIVE`** ✗ | **`DAMAGED INSTALL`** ✓ |
| full suite, **node 20** | 1 failed / 8 passed | **9 passed** |

✅**Non-vacuous AND precisely scoped:** revert only the `.mjs` to R2, keep tests, run on node 20 →
reproduces **exactly the one CI failure by name** (1 failed / 8 passed); restore → 9/9. No regression:
placement set-difference still empty, `merge-train.sh` still 2 hits, smoke still catches #1122 🔴2 on
node 20. ⭐**Retroactively settled my R2 declined-note: on node 20 the `detail:` line prints the real
cause ⇒ the UNDICI masking WAS my `NODE_USE_ENV_PROXY=1`. Declining to charge it was correct.**

### 🟡 The comment's stated mechanism is FALSE (and it justifies the new block)

`manifestProblem`'s header claims the resolver *"throws ERR_INVALID_PACKAGE_CONFIG on Node 24 and
resolves happily on Node 20."* Probed **five majors** against an unparseable manifest — **all five
THROW**: node20 `code=undefined`/`Error parsing …`; node21/22/23/24 `ERR_INVALID_PACKAGE_CONFIG`.
⇒ not a 24-vs-20 split but a **code-vs-no-code** split; node 20 never resolves happily. ⭐⭐**Right fix,
false stated reason — worth correcting because the next maintainer reads that comment to decide
whether the post-resolve block is still needed, and would reason from a false premise.**

### 🟡 The post-resolve block IS reachable — and its reachable case is a FALSE POSITIVE

⭐⭐⭐**Applied "when it turns on how PLAUSIBLE a state is, ask whether it can be CONSTRUCTED"** — built
a **BOM-prefixed `package.json`**: `require.resolve` → RESOLVED · `require('demo/package.json').name`
→ `"demo"` (Node reads it) · `node …/cli.js` → **exit 0** (package works) · `JSON.parse` → throws ⇒
guard says **`DAMAGED INSTALL` rc=1 on a HEALTHY install**. And since the check now runs inside
`merge-train.sh` under `rollback_and_fail`, that **rolls back an operator's merge** telling them to
reinstall a fine package. FIX = `.replace(/^﻿/,'')` before parse (verified it makes the same file parse).
⚠️**Bounded to 🟡 by measurement: 0 of 358 real store manifests carry a BOM.**
⛔**Instrument failure caught: first scan reported `scanned=0` because `find` does not follow pnpm's
symlinks — a FALSE ZERO that would have read as "no BOMs anywhere." Discarded; re-ran over
`node_modules/.pnpm` with the set size asserted >0 AND a synthetic BOM injected to prove the `od`
probe fires.** ⇒ ⭐⭐⭐**assert the SCAN SET IS NON-EMPTY before reporting any zero from it.**

✅**CI GREEN at `b10b7ea3`, confirmed at the reviewed head** (guarded against a newer push:
head still `b10b7ea3a`): check/ci/guard all pass, step 9 *"Assert runtime specifiers resolve in the
composed tree"* **success**, step 21 Host tests **success** — **162 files / 2262 passed / 3 skipped**,
vs R2's 1 failed / 161 passed. The R2-failing test name appears **0** times in the log.
⭐**Watched only the `ci` line in the monitor, then re-read the FULL check set + the job's step list
before crediting it** — a single-line pass is not the run.

## 2026-08-09 `synchronize` → head `663f7235` (R4, 1 commit): CI green, R4 fixes a hole I MISSED

Comment **`5231218120`**. **CI green** (check/ci/guard) at the reviewed head.

⚠️**This round the TEST FILE CHANGED too (9→13 tests, +57), so R3's byte-identical shortcut did NOT
apply.** ⭐⭐⭐**Replacement check, mechanical not eyeballed:** removed-line count = **1** (whitespace);
`comm -23` of R3-vs-R4 `it('…')` name sets = **EMPTY** ⇒ all 9 survive verbatim, 4 added.
⇒ **When the test file changes alongside the impl, the hash check is unavailable — diff the TEST-NAME
SET and count removed lines instead. A newly-green suite is only credit-worthy once you know no
expectation was dropped.**

✅**New contract tests non-vacuous BY MUTATION** (each mutation fails exactly its own test, node 20):
drop `smoke:['--version']` from `REQUIRED` → only *"still requires …smoke command"* fails; delete the
`check:runtime-deps` line from `merge-train.sh` → only *"runs the runtime-deps check…"* fails;
restore → 13/13. Full suite on real `npx -y node@20` → **13 passed**.

⭐⭐**`ENOENT` change closes a REAL hole I never found:** a package dir with **no `package.json`** still
resolves a deep file. Same tree — R3 `b10b7ea3` → **rc=0 `ok` "resolve, belong to this checkout, and
run"**; R4 → **rc=1 `DAMAGED INSTALL`**. ⇒ my R2/R3 passes had certified a broken install.

✅**`isOurs` widening (ownModules → repoRoot) checked BOTH ways** — widening a false-green guard is the
risky direction: parent install still rejected (`RESOLVED OUTSIDE`, rc=1) **and** the workspace case it
was for (`node_modules/demo` → `<repo>/vendor/demo`) now passes. `virtual-store-dir` limitation
documented, not hidden.

✅**`smokePlatforms` exact — 3-WAY match, verified not taken:** lockfile 6 · registry
`optionalDependencies` 6 · script list 6, identical. (Comment claimed "the lockfile carries exactly
these six" — true.)

### 🟡 Both R3 non-blockers STILL OPEN at this head (confirmed live, not re-raised as new)

1. **Line 172 comment still states the FALSE mechanism** ("throws on Node 24 and resolves happily on
   Node 20"). All five majors throw; 20 with `code=undefined`, 21–24 with the code. ⚠️**Matters MORE
   now: it is the stated justification for `manifestProblem`, and that function has since grown.**
2. **BOM false positive reproduces verbatim** — no BOM handling in the file; `manifestProblem` still
   parses raw bytes. Node 20: resolve OK · `require(manifest).name = "demo"` · cli exit 0 · guard
   **`DAMAGED INSTALL` rc=1 on a HEALTHY install**. Latent (0/358 store manifests). One line.

### 🟡 NEW — the success line asserts the half it skipped

When `smokePlatforms` excludes the host the skip is **loud and correct** (`smoke: NOT APPLICABLE …
Resolution was still enforced.`) and the gate's rationale is right (otherwise merge-train rolls back
every project merge over an inapplicable check). **But the summary still prints "All 1 runtime
specifier(s) resolve, belong to this checkout, *and run*"** on a run where "and run" never executed —
measured by excluding `linux-x64` from the list: rc=0 with BOTH lines. ⭐⭐**A gate whose whole purpose
is refusing to assert unverified things overstating its own summary is the PR's own thesis turned on
itself** — cosmetic (the honest skip line sits directly above), but exactly the class it fights.

**RESUME** = szihs pushes the 3 one-liners (BOM strip · line-172 comment · summary-line wording) ⇒
re-run the suite on a real `node@20`, re-diff the test-NAME SET (not the hash), and re-check BOM
prevalence with the non-empty-set assertion. All three 🟡 are in `check-runtime-resolvable.mjs`.
Superseded: szihs pushes the BOM strip / comment
correction ⇒ re-run the suite on a real node@20 and re-scan BOM prevalence with the non-empty
assertion. Superseded RESUME: szihs pushes the Node-20 code/message fix ⇒ re-run `Host tests` and re-probe with a real
`npx -y node@20` (never infer from my v22); or szihs replies. Original **RESUME (superseded, kept for lineage)** = a follow-up adds `check:runtime-deps` to `compose-check.yml` ⇒
re-census `grep -c check:runtime-deps` across all workflows with `frozen-lockfile` as positive
control. 🔴 is LIVE on `nv-main` (guard present but not in the deploy path). Related:
[[project_nanoclaw_1122_ccusage_pin_owned_file]], [[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]],
[[feedback_a_green_checker_that_excludes_the_changed_file]].
