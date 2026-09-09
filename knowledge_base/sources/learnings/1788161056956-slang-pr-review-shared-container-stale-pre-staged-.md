---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787725209453-66aoze
written_at: 2026-08-31T07:24:16.957Z
---

# slang-pr-review: shared-container stale pre-staged diff → INTEGRITY-FAIL, verify before trusting counts

When two `/slang-pr-review` runs execute concurrently in the same container, the second run's Reviewer-A (`slang-pr-review-runner`) can pick up the FIRST run's leftover `tmp/pr-diff.patch` / `tmp/pr-files.txt`. Symptoms on resume/merge:

- Summarizer per-subagent summaries say things like "The pre-staged diff does not correspond to the PR" / "data-mismatch failure" — a FIRST WAVE of subagents that got the wrong diff and correctly halted (the prompt mandates: "if any is missing or does not match this PR number, regenerate all three freshly").
- `run_dir_A/INTEGRITY-FAIL.txt` exists, listing `reviewed:` (wrong files) vs `actual PR files:`.
- The pipeline self-corrects: it regenerates the correct diff and a SECOND WAVE of subagents produces the real review.

**How to verify the final review is sound (do this, don't trust summarizer counts alone):**
1. `sha256sum run_dir_A/pr-diff.reference | cut -c1-12` must equal live `gh pr diff <N> -R <repo> | sha256sum | cut -c1-12`. If they match, the recorded reviewed diff == the live PR diff.
2. The `final-review.md` footer `diff sha256 <hash>` should match that, and run_dir_C's dir-name embeds the same hash (A and C reviewed the identical diff).
3. Spot-check that the clean verdicts cite evidence SPECIFIC to the real diff (function/symbol names from the actual change), not the leftover diff. Wave-1 bails have low tool counts (~3-4 tools); real reviews have 20-66 tools.

If all three hold, set `reviewers_complete=true` and report the verdict, but FLAG the self-corrected integrity event in the [Review Verdict] message and combined report for transparency. If the reference sha does NOT match live, re-run Reviewer A.

Also: `ls -dt transcripts/*/` grabs the newest dir which may belong to ANOTHER concurrent run (saw a `pr12813` clarity dir while reviewing 12766). Always capture MY run dir from the driver's own log line (`>>> output → <path>`), keyed to the PR number — never `ls -dt` blindly. And after a container restart, transcript dirs may be GC'd — preserve completed artifacts (e.g. Devin's `devin-flags.md`) to a stable `/workspace/agent/` path before re-dispatching failed reviewers.
