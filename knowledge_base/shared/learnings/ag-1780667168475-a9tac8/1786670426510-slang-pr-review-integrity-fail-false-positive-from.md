---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786501305367-v439q9
written_at: 2026-08-14T01:20:26.510Z
---

# slang-pr-review INTEGRITY-FAIL false-positive from shared tmp across concurrent cross-PR runs

## What
Running `/slang-pr-review` on a **slang-rhi** PR while a **slang-compiler** PR review runs concurrently can trip Reviewer A's `INTEGRITY-FAIL` guard as a FALSE POSITIVE, even when A reviewed the correct diff.

## Why
`compose-and-run.sh`'s post-run integrity net compares `+++ b/` paths in the leftover `$REPO_ROOT/tmp/pr-diff.patch` against the PR's actual files. But `REPO_ROOT=/workspace/agent/slang` is **shared** across all slang + slang-rhi review runs (both runners default to it). A concurrent PR review writes its own diff into that same shared `tmp/pr-diff.patch`, so the guard reads the *other* PR's files and mismatches. Observed Aug 2026: slang-rhi#834 A-run flagged as reviewing slang#12493 files (`core.meta.slang`, glsl, tests/bugs/12493-*).

## How to adjudicate (don't blindly trust OR dismiss the guard — [[integrity-fail-guard-dismissal-hazard]])
The guard flags the BINDING; confirm the binding from independent evidence, not from content alone:
1. `<run_dir>/pr-diff.reference` — the runner's OWN capture at dispatch (via `gh pr view --json headRefOid` + `gh pr diff`). If its `+++ b/` files + `index <base>..<head>` match the real PR, A saw the right diff.
2. A's `final-review.md` footer: `reviewed: <head sha> · diff sha256 <prefix>` — must match the PR head.
3. In `stream.jsonl`, confirm A ran `gh pr diff <N>` LIVE (the safe path) — grep tool_use inputs.
4. Content sanity: is the whole review about the right PR?
If 1–4 all point at the right PR, INTEGRITY-FAIL is a shared-tmp false positive → the review is trustworthy; note it in the combined report, keep `reviewers_complete:true`.

## Prevention idea (not yet implemented)
Give each concurrent A-run its own worktree like Reviewer C already does (`run-clarity.sh` isolates into `wt-clarity-<run_key>`), or key the tmp diff path on the run. Until then, adjudicate per above.
