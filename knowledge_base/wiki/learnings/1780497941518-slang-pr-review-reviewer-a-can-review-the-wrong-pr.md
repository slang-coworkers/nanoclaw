---
title: "slang-pr-review Reviewer A can review the WRONG PR via stale tmp/pr-diff.patch"
type: learning
topic: review-process
source: learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md
---

# slang-pr-review Reviewer A can review the WRONG PR via stale tmp/pr-diff.patch

## Symptom
A `/slang-pr-review` run on PR #11455 (a `[nodiscard]` feature) came back with Reviewer A (the nv-slang-bot / slang-pr-review-runner correctness pipeline) reviewing a completely different change — PR #11443's namespace `using`-re-export fix in `source/slang/slang-check-decl.cpp`. A's `final-review.md` was internally coherent but about the wrong PR, including a confident "silent breaking language change" finding that does not apply.

## Root cause (confirmed)
`slang-pr-review-runner`'s inner claude CLI writes the diff to `/workspace/agent/slang/tmp/pr-diff.patch` via `gh pr diff <N> -R <repo> > tmp/pr-diff.patch`. The CLI sandbox **blocks `mkdir tmp` and `> tmp/...` redirects under CWD** (the documented "mkdir/redirect retry dance" gotcha). When a **stale `tmp/pr-diff.patch` from a prior review of a different PR already exists**, the denied write leaves the stale file in place, and A's subagents (told to "Read tmp/pr-diff.patch") review the stale diff. The correct file list *was* fetched into `tmp/pr-files.txt`, so the diff and the file-list contradicted each other — A's main agent "resolved" this by trusting the stale diff and dismissing the real PR title/body as a "stale PR description."

Evidence: `tmp/pr-diff.patch` mtime = a prior run, content = #11443 (14× `slang-check-decl`, 0× `nodiscard`); `tmp/pr-files.txt` mtime = current run, content = the correct 6 nodiscard files.

## How to catch it (reviewer-coordinator MUST do this)
Independently verify the PR's real diff before trusting Reviewer A: `gh pr view <N> -R <repo> --json files,additions,deletions` + `gh pr diff <N> -R <repo> | head`. If A's reviewed files don't match, A misfired — exclude it. (Cross-checking A was already a known practice; this is a concrete new failure mode.) Note: `gh auth status` may warn "token invalid" for a bot installation token while `gh pr view/diff` still work fine for reads — don't trust the status warning, test an actual read.

## Fix / workaround
- Before any A run on a shared checkout: `rm -f /workspace/agent/slang/tmp/pr-diff.patch`.
- Proper fix (skill owner): `slang-pr-review-runner` should write the diff under its own per-run `run_dir`, not the shared checkout `tmp/`, OR clear `tmp/pr-diff.patch` at the start of `repro.sh`/`compose-and-run.sh`.
- Drift was 0 (A posted nothing), so a misfire is silent unless the coordinator verifies the diff.

## Counting caution (separate, from the fixer)
`grep -c "E30059"` over-counts slangc diagnostics because slangc echoes the offending source line inside each diagnostic block; count `warning\[E30059\]` headers instead.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md`_
