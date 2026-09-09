---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788756306912-tt12ar
written_at: 2026-09-07T08:21:55.552Z
---

# slang-pr-review-runner: concurrent reviews in shared base-clone contaminate each other via tmp/pr-diff.patch

## Symptom
A `/slang-pr-review` Reviewer-A run (`compose-and-run.sh`) exits **1** with an `INTEGRITY-FAIL.txt` whose "reviewed" file list is a **completely different PR's** files (not a stale-diff of the same PR). Example seen: reviewing PR #12922 (`slang-ir-util.cpp` + `debug-info-*` tests), but the guard reported it reviewed `slang-check-decl.cpp` + `zero-initialize/*` tests — another PR (#12921) entirely.

## Root cause
Multiple PR reviews run concurrently against the **same shared base clone** `/workspace/agent/slang`. The inner `claude` CLI reviewer follows `REVIEW.md`, which writes/reads the diff at `/workspace/agent/slang/tmp/pr-diff.patch` — a **shared, non-isolated** scratch path. A concurrent review of a different PR overwrites that file mid-run, so your reviewer reads the other PR's diff. `compose-and-run.sh`'s own `pr-diff.reference` (captured via `gh pr diff` into the isolated run_dir) is still correct — that's what the integrity guard compares against, which is exactly why it catches the mismatch and exits 1. The guard is working; the contamination is real and cross-PR.

## What is / isn't reliable under concurrency
- **Reliable regardless:** Reviewer B (Devin) scrapes the PR page directly; Reviewer C (`run-clarity.sh`) writes run dirs named `pr-pr<N>-<headSHA>-<diffhash>-...` and fetches its own `gh pr diff` — verify its `clarity-review.md` topic-matches your PR (grep for PR-specific identifiers, expect 0 wrong-PR matches).
- **Trap:** picking a run dir by `ls -1dt transcripts/* | head -1` ("newest") is **unsafe** — a concurrent review's dir may be newer. For clarity dirs, match explicitly by `pr-pr<N>-<headSHA>*`. For Reviewer A dirs (named only `pr-<timestamp>`, no PR number), confirm by grepping the dir's `pr-diff.reference` for your PR's files + checking timestamp against your dispatch.

## Recovery
Retrying is **safe and self-verifying** — the integrity guard cannot silently pass a wrong diff. Retry Reviewer A once; it usually lands clean once the colliding concurrent review's write window has passed. Do **not** `rm` the shared `tmp/pr-diff.patch` to "fix" it — a concurrent review may be using it (not yours to delete). If retries keep racing, report the blocker and rely on: a prior clean review of the identical source logic (check the GitHub compare of the two heads — if the delta is comment/test-only, the earlier correctness verdict still covers current logic) + the PR-accurate C and Devin passes.

## Also
`getTypeNameHint` fan-out is wide (~19–20 consumers). One non-obvious consumer is `addUserTypeHintDecorations` (`slang-ir-user-type-hint.cpp:24`) implementing `-fspv-reflect`: adding a `getTypeNameHint` case flips a previously-empty hint to non-empty, which **starts emitting a `UserTypeGOOGLE` reflection decoration** for global params of that type — a user-observable, easily-untested side effect on the reflection path. Worth flagging on any PR that adds `getTypeNameHint` cases.
