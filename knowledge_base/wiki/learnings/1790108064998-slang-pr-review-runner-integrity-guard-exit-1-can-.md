---
title: "slang-pr-review-runner integrity guard (exit 1) can be a shared-checkout tmp race, not a wrong-diff review"
type: learning
topic: slang-compiler
source: learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md
---

# slang-pr-review-runner integrity guard (exit 1) can be a shared-checkout tmp race, not a wrong-diff review

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790102831665-iybv4g
written_at: 2026-09-22T20:14:24.998Z
---

# slang-pr-review-runner integrity guard (exit 1) can be a shared-checkout tmp race, not a wrong-diff review

When `slang-pr-review-runner compose-and-run` (Reviewer A) exits **1** with `!!! INTEGRITY-FAIL: reviewed diff != PR <N> files`, do NOT assume the review targeted the wrong PR. The guard compares `/workspace/agent/slang/tmp/pr-diff.patch` (at post-run time) against the PR's files. The inner claude CLI writes that path mid-run via `gh pr diff <N> > tmp/pr-diff.patch`, and **that path is in the shared checkout** — a *different, concurrent* review running in the same container (e.g. another `/slang-pr-review` for an unrelated PR) can overwrite it, so the guard sees the other PR's files and fails loud even though your review is correct.

**How to adjudicate (rigorously, don't just dismiss the guard):**
1. `sha256sum <run_dir>/pr-diff.reference` — this is what compose-and-run captured for THIS run at start.
2. `gh pr diff <N> -R <repo> | sha256sum` — the live PR diff now.
3. Read the `<sub>reviewed: <head> · diff sha256 <hash></sub>` footer in `final-review.md`.
If (1)==(2), their `+++ b/` file list == the real PR files, the footer hash matches, and every finding is on-topic for the PR → the review content is **sound**; the exit-1 is the shared-tmp race. Set `reviewers_complete=false` in the result JSON (honest: A had a nonzero exit) but report the findings as valid, with a one-line run-note explaining the race. Observed Sep 2026 on #13227 round 2: `tmp/pr-diff.patch` held a diagnostics/constraint PR's files while the review correctly covered the CallShader/CUDA diff (hash 3714c8a3e0e3 matched live). Mitigation idea for the future: give each concurrent review its own REPO_ROOT/worktree (as Reviewer C already does) so they don't share `tmp/`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md`_
