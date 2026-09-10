---
name: project_nanoclaw_1112_fail_closed_split
description: "nanoclaw#1112 (szihs, fail-closed task snapshots + owned-drift verifier) CLOSED mid-review and split into merged #1119+#1120; reviewed INLINE (~32nd routing instance). 2🔴 on #1120: pathspec installed in ci.yml but Host tests also runs in compose-check.yml (compose red on nv-main since f03cff946, reproduced 6-fail/13-pass by PATH alone); matcher read from worktree while its allowlist is read from the ref ⇒ a reverted ownership.py yields exit 0 on drifted tree. Comments 5205786228 (#1120) + 5205790494 (#1112)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 973fe4d6-47bd-4ca8-8434-3a07f3751993
---

# nanoclaw#1112 → split into #1119 + #1120

`slang-coworkers/nanoclaw#1112`, author **szihs**, branch `fix/nv-main/fail-closed-snapshots`
→ `nv-main`, opened 2026-08-06T13:20:42Z. 8 files, +601/−69. Two webhooks (`opened`, then a
`synchronize` that was **CI-only** — a `setup-python` pin — so code measurements carried).

**Routing: INLINE by Main**, ~32nd instance of the standing rule. The webhook again carried the
generic post-#874 *"route to the project's `*-pr-approver`"* string; both approvers in destinations
are repo-scoped compiler approvers that would `ABSTAIN_POLICY` on platform-infra.
See [[project_nanoclaw_pr874_webhook_route_approver]].

## ⛔ The PR was CLOSED mid-review, not merged — and the content landed anyway

State recheck immediately before drafting returned `state: CLOSED`. **`merged: false`,
`merged_at: null`, but `merge_commit_sha` non-null** — closed by szihs at 13:39:49Z and
**superseded by #1119 (F18 dumper) + #1120 (F11 verifier), both merged ~2 min later**, split on
*revert profile* rather than failure shape.

⭐⭐⭐ **`merge_commit_sha` is populated on a merely-CLOSED PR** (GitHub computes it for any
mergeable PR), so it is **not** evidence of a merge — only `merged`/`merged_at` are. Had I read the
sha as a merge I'd have filed against a tree nobody was running.

⭐⭐⭐ **A closed PR is not a dead review when its content was split.** All 6 shared blobs at head
`e0830a8b` were **byte-identical** to `nv-main`'s tip by `git rev-parse` ⇒ every measurement carried
over with zero re-work. The correct move was to re-target the findings at the successor that owns
them, not to drop the chain. **Verify the successors' comment counts first**: #1119 already had a
concurrent session's review; #1120 had **zero**.

⚠️ **My finding 1 (partial commit) duplicated the sibling's headline on #1119** — I reproduced it
independently (md destination as a directory ⇒ `os.replace` raises, JSON already renamed, handler
prints `Nothing was replaced.` and returns 3; reverse leg with the JSON dest blocked leaves the md
untouched, so it is order-specific) before finding their comment. **Cost was duplicated effort, not a
wrong claim** — same rule as #1088: check for a sibling row on a same-batch PR *before* reviewing.

## 🔴 1 (#1120) — `pathspec` installed in the wrong workflow; `compose` red *because of* this PR

The install landed in `ci.yml`'s `ci` job, but `Host tests` (`pnpm exec vitest run`) also runs in
**`compose-check.yml`:97**, which has **no `setup-python` and no pip step at all** (`grep -c` for
`pathspec|setup-python` → **0**, still 0 at the later tip `b9c43172`). So `ownership.py` exits 2 at
its import guard and the script's own fail-closed preflight turns that into exit 2.

Reproduced locally byte-for-byte against the CI log — same 6 tests, same `expected 2 to be <0|1>`
assertions. **Both directions, one variable (`PATH`):**

| interpreter | `setup/nv-owned-drift.test.ts` | control `scripts/dump-scheduled-tasks.test.ts` |
|---|---|---|
| no `pathspec` | **6 failed / 7 passed** | 6 passed |
| `pathspec` | **13 passed** | 6 passed |

⭐⭐ **The sibling file passing in BOTH runs is what makes this a `pathspec` result and not a broken
harness.** `Compose Check` red on `nv-main` since `f03cff946` = #1120's own merge commit.

## 🔴 2 (#1120) — the matcher is read from the WORKTREE while its allowlist is read from the REF

The allowlist is deliberately `git show "$REF:…nv-main.txt"` — *"a silently-reverted allowlist must
not get a say in judging itself."* But `MATCHER="$PROJECT_ROOT/.github/nv-path-guard/ownership.py"`.
`ownership.py` is a `.github/**` path so **`nv-main` owns it** (verified through the real 111-pattern
allowlist), and the candidate loop **skips `.github/nv-path-guard/*` by design** ⇒ a drifted matcher
is never a reported candidate either.

| worktree `ownership.py` | result |
|---|---|
| intact (**control**) | exit **1**, reports `src/owned.ts` |
| stale copy dropping glob patterns | exit **0**, `ok: no nv-main-owned file differs` |

Output never mentions `ownership.py` (grep 0). ⭐⭐⭐ **Data judged from the ref, judge taken from the
tree under test, and excluded from its own report** — the same silent-revert class the script exists
to find. Branch census: `ownership.py` on **`nv-main` only** of 14 remote branches (`check.py` on 6 as
the positive control), so overlays currently hit the clean exit-2 preflight; the first overlay to
absorb a copy becomes eligible to drift silently.

**Fix verified with both controls** (`MATCHER="$WORK/ownership.py"` + `git show "$REF:…"`):
tampered worktree matcher → **1** with `src/owned.ts` (was 0); intact → still **1**; on `nv-main`
itself → clean **0**. It also removes the worktree-file preflight that currently returns exit 2 on
all four overlay branches (base script returned 1 with 427–429 files on the same trees).

## Verified correct, each with the control that made it real

- **Non-inert:** swapping both merged scripts for their pre-change versions fails **9 of 19** cases.
- **`check.py` refactor behaviour-preserving:** `ok: all 8 changed file(s) match nv-main's allowlist`;
  positive control (commit unowned `groups/probe/f.txt`) → exit 1 naming it.
- **The over-match the PR removes is REAL on live data:** `origin/nv-slang` vs `origin/nv-main`, 535
  candidates → old matcher **489** owned, new **485**; the 4 extra are
  `groups/templates/instructions/*.md`, owned only because `.gitignore` carries a `groups/`-shaped rule.
- **Fail-closed asymmetry is deliberate:** `check.py` still `return 0`s on missing/empty allowlist
  (required check must not block every PR); flagged only as a docstring gap, since *"one
  implementation, so CI and the verifier cannot drift"* reads as full parity while the skip policy differs.
- **Artifact/generator drift:** running the new generator over the committed 13 tasks differs by
  exactly +2 JSON lines (`complete`, `listed_count`) / +3 md lines ⇒ the snapshot predates the
  generator change. `listed_count` has **no consumer** outside the script + its test (control:
  `task_count` → 4 files). Not charged (the sibling covered it on #1119).

## ⛔ My own instrument defects, both caught pre-publish

1. ⭐⭐⭐ **`grep -E '[ \t]+$'` counted 15 trailing-whitespace lines; the true count is 0.** In POSIX
   ERE `[ \t]` is the set {space, backslash, `t`} — **not tab** — so it matched every line ending in
   the letter `t` (line 84: `daily-repor`**`t`**). Python `rstrip` said 0 and I initially distrusted
   the *right* instrument. Resolved with a control (append one real trailing-space line): `[[:blank:]]`
   → 1, `grep -P` → 1, python → 1, **broken pattern → 16**. ⇒ **when two of your own measurements of
   one quantity disagree, resolve it with a control before believing either**; and
   `[ \t]` in ERE is silently wrong — use `[[:blank:]]` or `grep -P`.
2. **`git worktree add` under a clone shared across sessions self-destructs.** My worktree metadata
   vanished (`fatal: not a git repository: …/worktrees/wt-1112`) while siblings' `wt-1109`/`wt-1111`
   survived — `/tmp` is per-container, so another session's `git worktree prune` sees my path as
   absent and removes it. ⇒ **use an independent `git clone --no-hardlinks` (plain `--local` fails
   `Invalid cross-device link` between `/workspace` and `/tmp`), never a worktree, in a shared clone.**

⚠️ `node_modules` symlinked from the KB tree whose `package.json`/`pnpm-lock.yaml` **differ** from the
PR head — disclosed-scope: fine for these two self-contained files (both pass at head), not a basis
for a whole-suite count.

**Write path:** `gh api repos/.../issues/<n>/comments --method POST --input <json>` (verb-split rule).
Comments **5205786228** (#1120, the substantive review) + **5205790494** (#1112, routing closure).

**RESUME** = szihs replies. Both 🔴 are **LIVE on `nv-main`** (files byte-identical at `b9c43172`):
`compose` stays red until `compose-check.yml` gets `setup-python` + `pip install pathspec`, and the
matcher-provenance gap is a one-line fix already verified with both controls.
