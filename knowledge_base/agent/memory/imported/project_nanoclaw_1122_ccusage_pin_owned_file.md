---
name: project_nanoclaw_1122_ccusage_pin_owned_file
description: "nanoclaw#1122 ccusage pin — MERGED mid-review (10th race); 2🔴: the pin lands on nv-main-OWNED package.json so both resolvers strip it (CI's own green install proves it), and `unavailable` is null in the confident-$0.00 state. Comment 5206610544."
metadata: 
  node_type: memory
  type: project
  originSessionId: 73bc7a6b-93b3-4779-bd6e-12f696b8d2a9
---

# `slang-coworkers/nanoclaw#1122` — "dashboard: pin ccusage instead of executing whatever npm serves today"

Author **szihs** (human/maintainer), base **`nv-dashboard`**, branch `fix/nv-dashboard/ccusage-no-npx`.
Fixes F13 (#937 follow-up). Handled **INLINE by Main** per the standing repo rule (nanoclaw-platform
fork, no nanoclaw approver wired) — the webhook's generic "route to `*-pr-approver`" string is
overridden. See [[project_nanoclaw_pr874_webhook_route_approver]].

**MERGED mid-review** 14:21:11Z, merge commit `c7d5752d` (**10th merge race** in this series).
Reviewed head `5461f30b` → re-measured at `f9a239e1` after a `synchronize`. Merged blobs ==
reviewed head **BY HASH, 5/5** (`server.ts 9b177602`, `app.js 799bcf1c`, `package.json 884e55c6`,
`pnpm-lock.yaml a8e6411e`, `ci.yml f6686458`). Comment **`5206610544`**.

## ⭐⭐⭐ The headline: a green CI that never installed the dependency the PR adds

`package.json` + `pnpm-lock.yaml` are **nv-main-OWNED** (verified with CI's own gitwildmatch matcher
over `nv-main.txt`; `dashboard/**` is not owned — control `dashboard/nonexistent.xyz` → not owned).
`origin/nv-main` carries **zero** ccusage refs. So both resolvers overwrite the declaration:

- **`ci.yml`'s composed merge** — already happened *in this PR's own green run*. The install step
  enumerates 25 top-level packages (11 deps + 14 devDeps) and ccusage is **absent**; controls
  `better-sqlite3 11.10.0` / `cron-parser 5.5.0` / `kleur 4.1.5` all listed. ⭐⭐⭐**The sharpest
  single datum: the list DOES include `@chat-adapter/telegram 4.29.0`, which exists only in
  nv-main's manifest and not this branch's — a positive marker proving WHICH manifest was read,
  rather than merely noting an absence.**
- **`merge-train.sh` whole-owned-set sweep (lines 108–113)** — reproduced verbatim on
  `nv-coworkers` + merged tip: **448 owned files swept**, ccusage → **0** in both files, while
  `dashboard/server.ts` stays at the PR blob `9b177602` (re-checked *after* the sweep as a presence
  control).

Net: the **security half survives** (server.ts is the new version, npx genuinely gone — all 5
remaining `npx ccusage` hits are comments, verified by line) but `require.resolve` then throws and
the panel reads, verbatim from running this code in that dependency shape:
`ccusage is not installed in this checkout — run \`pnpm install --frozen-lockfile\`` — **permanently**,
because a composed `--frozen-lockfile` installs nv-main's manifest. `dashboard/` does not exist on
`nv-coworkers` at all; it arrives only via the merge-train leg, and `compose-check.yml` calls that
tree "the real deploy compose". The repo's OWN `check-nv-owned-drift.sh` lists both files as drift
on the merged tip and prints `git checkout origin/nv-main -- <file>` — i.e. the revert.
⚠️**Control that kept this honest: both files ALREADY drifted at the pre-PR base** (unrelated script
differences) — what this PR *adds* to that drift is the single `+ "ccusage": "20.0.19"` line.
FIX = declare ccusage **on nv-main**, keep the server.ts/app.js half here.

## 🔴 2 — `unavailable` is `null` in exactly the state that renders a confident `$0.00`

The field is wired to `require.resolve`, but what can fail is the **spawn**: the package resolves
from `node_modules/ccusage/src/cli.js` while the **native binary** lives in a separate
platform-specific *optional* dep. Two different success conditions ⇒ a reachable state where
resolution succeeds and execution cannot. Measured, one variable, both directions:

| native optional dep | resolve() | `unavailable` | rows | UI |
|---|---|---|---|---|
| absent (`--omit=optional`) | succeeds | **null** | 0 | **$0.00** |
| present *(control)* | succeeds | null | 52 | $4583.36 |

`cli.js` exits 1 (`native binary is not available for linux-x64`), `runCcusage` takes the `err`
branch → `[]`, panel prints `$0.00` uncaveated — the exact outcome the guard's own comment exists to
prevent. ⭐⭐**The PR body even NOTES cli.js "prints a bounded error when the native package is
absent" — the state is known; the guard just doesn't reach it.** The `err` branch already holds the
signal.

## ✅ Verified-good (the bulk of it) — checked against the registry, not taken

`ccusage@20.0.19` published **2026-07-27** (10 days > the 3-day/4320-min gate) ⇒ no
`minimumReleaseAgeExclude` needed; its only script is `build`, **not** an install lifecycle hook; all
**six** `@ccusage/ccusage-<platform>` optional deps have `scripts: {}` ⇒ no `onlyBuiltDependencies`
entry needed. Read the published `src/cli.js` end-to-end from the real tarball: launcher only,
`require.resolve` + spawn, **no download path** — as described. Resolution is a pure fs lookup
(measured, zero network).

## 🟡 Non-blockers

- **No test on the new `unavailable` contract.** Author's "no test could have broken" is right —
  `grep -rn 'ccusage|npx|token-metrics|cost-history' dashboard/*.test.ts` → **0** (control
  `api/state` → 9). Flip side: the new contract also ships untested; one unresolvable-module case
  would pin 🔴2.
- `/api/cost-history` gains `unavailable` with **no consumer** — `cost-history` appears exactly once
  repo-wide (the route). Only `/api/token-metrics` is fetched by `app.js`.
- **`homedir` import now dead** (`server.ts:20`; base had a 2nd occurrence in the deleted
  `~/.npm/_npx` scan). **Nothing catches it:** `noUnusedLocals` unset · eslint scoped `src/**` ·
  `format:check` `src/**/*.ts` · #1133's widened `tsconfig.typecheck.json` includes
  `src*,setup,scripts` — **not `dashboard`**.

## The CI red — independently reproduced, agrees with the author

With `pathspec` absent, `ownership.py` can't import → `check-nv-owned-drift.sh` exits **2** → six
assertions fail inside their own hermetic fixtures; with it present **13/13**. Per-branch census:
`pip install pathspec` + `setup-python` exist in **nv-main's `ci.yml` only** (1 vs 0 on all four
overlays; control `frozen-lockfile` present everywhere). ⭐⭐⭐**#1134 landed 6 SECONDS before this
PR merged** and makes `ownership.py` provision its own venv — verified locally with pathspec absent
(clean 0 / drift 1 / `--allow` 0) ⇒ the two `ci.yml` steps added in `f9a239e` are now
belt-and-braces, not load-bearing. Both work; no action. See
[[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]].

## ⛔ My own instrument failures this review (each caught by a control, none published)

1. ⭐⭐⭐**Worktree registrations were pruned by a CONCURRENT session mid-review** — `git -C /tmp/composed`
   and two `git checkout` steps died with `fatal: not a git repository`, and the *next* line in the
   same block printed `ccusage in package.json: 0` — **a false zero that agreed with my hypothesis.**
   ⇒ Redid the load-bearing repro in a standalone `git clone --shared` (immune to prune) with a
   **presence control** (`dashboard/server.ts` exists AND == the PR blob) asserted *before* any count.
2. ⛔A 5-branch merge-train chain **aborted at the nv-slang leg** on two conflicts `nv-main.txt`
   doesn't own — so `dashboard/` never existed and `grep -c ccusage` counted a file that was never
   composed. Same shape: **a count over a set that was never built.** Discarded, re-ran single-overlay.
3. ⛔`python3 -m venv /tmp/psvenv -q` **failed silently**; `&& pip install` short-circuited, and the
   only symptom was `No such file or directory` two commands later.
4. ⛔`grep -cE "from '[^']*ccusage"` — the shell ate the bracket expression (`No such file or
   directory`) and printed a filename-prefixed `1` that read as a hit. Corrected quoting → **0**,
   control `better-sqlite3` → 1.
5. ⛔**Published-count error, recounted and announced rather than quietly swapped:** first said the
   install log names *24* packages (`grep -c` over a `sed` window that started one line late); the
   artifact says **25**. Fixed before posting.

⇒ ⭐⭐⭐**Five instrument failures, and every one of them failed toward the answer that licensed my
conclusion.** The only thing that separated them from findings was a control that could return the
other answer — never re-reading my own reasoning.

**RESUME** = szihs replies, or a follow-up declaring ccusage on nv-main lands ⇒ recheck whether the
composed tree installs it (`gh run view <ci job> --log | grep ccusage`, with a named-package positive
control). Both 🔴s are **LIVE on `nv-dashboard`** and in the composed deploy tree. Unmerged siblings
this batch: #1110/#1124/#1125 (already bot-reviewed — check for a sibling row before re-reviewing),
#1123 (same pathspec red, nv-slang).
