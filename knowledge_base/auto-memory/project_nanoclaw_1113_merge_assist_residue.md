---
name: project_nanoclaw_1113_merge_assist_residue
description: "nanoclaw#1113 merge-assist residue gate — reviewed inline LGTM, 2 latent 🟡 + 1 nit; I RAN the author's 11 tests they could not (arm64 esbuild vs my x86_64); pre-flight-abort concern DISPROVED by prevalence check (merge-train artifacts are gitignored)"
metadata:
  node_type: memory
  type: project
  originSessionId: 82debb7e-12cb-4efa-818b-985eecdc4f5d
---

# nanoclaw#1113 — merge assist treats staged/untracked residue as failed composition (szihs → `nv-main`, +339/−3, 2 files)

Reviewed at `e27ee928` 2026-08-06 ~13:50Z. **LGTM**, 2 latent 🟡 + 1 nit, none blocking.
Comment [`5205510803`](https://github.com/slang-coworkers/nanoclaw/pull/1113#issuecomment-5205510803).
Routed **INLINE by Main** — Nth instance of [[project_nanoclaw_pr874_webhook_route_approver]]
(nanoclaw platform fork, no nanoclaw approver wired; webhook carried the generic
"route to `*-pr-approver`" string).

⚠️**Webhook said `mergeStateStatus: UNSTABLE`** — that was only `ci` still *pending* at webhook
time. Re-checked 15 min later: all 3 green (ci 2m17s / check 7s / label 2s).
⇒ **A merge-state at webhook arrival is a snapshot of an in-flight run, not a verdict** — re-poll
before treating UNSTABLE as a finding. Cf. [[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]].

## ⭐⭐⭐ The reviewer's edge: I could run what the author could not

PR body discloses *"Vitest cannot start on the dev machine here (the installed esbuild is
`linux-arm64`)"* — 19 assertions were run under hand-rolled `tsc`+Node instead. **I am x86_64 with
a real clone (`/workspace/agent/nanoclaw-kb`, `node_modules` + vitest present).** Fetched
`refs/pull/1113/head` into a `git worktree`, symlinked `node_modules`, ran the actual suite:
**11 tests / 11 passed**, 19 `expect()` (stated count exact).

⇒ ⭐⭐⭐**When a PR body says "I could not run X", check whether YOU can — that converts the
author's weakest evidence into the review's strongest, at near-zero cost.** The whole review's
authority came from this one asymmetry, not from reading the diff.
✅**Reusable recipe** (no clone-per-PR needed): `git fetch origin pull/N/head:brN` →
`git worktree add /tmp/wtN brN` → `ln -s <existing>/node_modules /tmp/wtN/node_modules` →
`node_modules/.bin/vitest run <path>`. ⚠️Vitest honors `vitest.config.ts` `include:` — a probe test
placed OUTSIDE those globs silently reports **"No test files found"** (hit this: `probe/edge.test.ts`
→ 0 files; moving it to `setup/lib/` ran it). *A test runner's "no files" is indistinguishable from
"all passed" if you only read the exit narrative.*

## ⛔ My main concern, DISPROVED by prevalence check before publishing

I suspected the new pre-flight abort **breaks the LLM tier's own entry path**: `composeMergeViaClaude`
runs *because* merge-train failed, and `merge-train.sh:134` runs `pnpm install && pnpm run build &&
npm run rebuild:claude` before `rollback_and_fail`, whose `git reset --hard` leaves untracked files.
Had that been right it was a 🔴 on the PR's central mechanism.

**Measured instead: those artifacts are gitignored** — `dist/` (`.gitignore:7`) and `groups/*`
(`.gitignore:15`, covers `groups/main/CLAUDE.md` written by `rebuild:claude`). Created all three in a
real checkout → `git status --porcelain=v1 -uall` → **empty**. Gate is safe on the real entry path.
⇒ ⭐⭐**A mechanism that COULD fire is not a finding until you check the producer actually emits the
input.** Same family as [[feedback_mechanism_must_predict_observed_coordinates]].

## Findings (both verified by execution against the real exported functions)

1. 🟡**Embedded git repo ⇒ `-uall` emits a DIRECTORY entry (`?? vendored/`) that cleanup cannot
   remove.** `fs.rmSync(dir, {force:true})` throws `ERR_FS_EISDIR` (**`force` suppresses ENOENT, not
   EISDIR**) into the empty `catch {}`; the pruner also skips it since `path.dirname('vendored/')`
   === `'.'`, filtered by `d !== '.'`. **NOT a silent failure** — the post-cleanup re-check surfaces
   "still not clean", i.e. correct failure direction. **Latent:** only embedded repo in a real tree
   (`groups/archive-probe/.git`) is itself gitignored ⇒ never emitted; no `.gitmodules` in repo.
2. 🟡**The error message's remedy doesn't clear the condition.** Says *"Commit or stash them first"*;
   for the untracked-only case (the PR's headline shape) bare `git stash` prints **"No local changes
   to save"** and leaves residue → re-run hits the same block. Measured 1 → stash → 1 → `stash -u` → 0.
3. **Nit: both cited checks are blind to the diff.** `tsc -p tsconfig.json` has
   `include: ["src/**/*"]`; prettier glob is `src/**`. `tsc --listFiles` → **0** of 598 files match
   `setup/`/`claude-assist` (**positive control `src/index` → 1**, so the zero is measured).
   CI's `vitest run` *does* cover it (`vitest.config.ts` includes `setup/**/*.test.ts`) and is green;
   **no CI step typechecks `setup/**` at all.**

## Author's disclosures — all three verified TRUE

`runner.ts:335` TS2554 pre-existing (`git diff --stat base..HEAD -- setup/lib/runner.ts` → **empty**,
file untouched) · `claude-assist.ts` **was already prettier-dirty at the base blob** ⇒ leaving it
unformatted to hold the diff at 136/3 is the right trade · "19 assertions" exact.
⇒ ⭐**Verifying an author's self-reported weaknesses is cheap and buys calibration** — three honest
disclosures raised my confidence in the parts I could not measure.

## Git probes worth reusing (all measured, not recalled)

- `git status --porcelain=v1 -z` rename order = **new path first, original second** ⇒ the `i++` skip
  keeps the right path. A **worktree-side** rename never makes a 2-field entry (degrades to
  ` D old` + `?? new`) ⇒ no over-consume shape exists.
- `reset --hard` **deletes a staged-NEW file** but leaves untracked ⇒ confirms the hole closed is
  exactly the untracked one.
- `-uall` reports **nothing** for an empty dir, or a dir holding only ignored files.
- ⭐**`git status` never emits a through-symlink path** (`?? link`, not `link/p.ts`). My probe DID
  delete through a symlink via `removeRecordedFiles(['link/precious.ts'])` — but the **producer
  cannot generate that input**, so it is not reachable. ⇒ **a hand-synthesized input proves nothing
  until you show the real producer emits it**; reported as unreachable, not as a bug.

**RESUME** = szihs replies ⇒ offer the `stash -u` message wording and (optionally) `{recursive:true}`
for the directory-entry case — noting `-uall`'s deliberate non-descent into nested repos is itself an
argument for warn-not-delete. Merge is the maintainer's (`nv-main`, szihs-owned, outside
[[feedback_nv_coworkers_automerge]]).
