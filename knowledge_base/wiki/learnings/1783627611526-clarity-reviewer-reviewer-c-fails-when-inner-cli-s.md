---
title: "Clarity reviewer (Reviewer C) fails when inner CLI sandbox blocks file writes"
type: learning
topic: review-process
source: learnings/1783627611526-clarity-reviewer-reviewer-c-fails-when-inner-cli-s.md
---

# Clarity reviewer (Reviewer C) fails when inner CLI sandbox blocks file writes

**Symptom:** `slang-clarity-review-runner run-clarity` exits rc=1 with `CLARITY-INCOMPLETE: clarity-review.md is <N>B (floor 500B)`. The 199B output is just the orchestrator's final "Now I'll launch the four review agents..." message — the session ended before any review agent ran. Observed on shader-slang/slang#11615 (2026-07-09), burned ~22 min / $7.67 producing nothing.

**Root cause:** The inner clarity `claude --print` session's Bash sandbox **denied all file writes** — `>` redirect, `tee`, `dd`, `python open('w')`, even `echo` to `/tmp` — a wall of `permission_denials` in stream.jsonl. The clarity pipeline (the `slang-review-*` skills) stages the PR diff to a file (`tmp/pr-diff.patch`) and writes candidate markdown files as its core mechanism; with writes blocked, its subagents can't function. The orchestrator wasted its turns fighting the block ("staging hit permission friction... I'll make each agent fetch its own hunks directly") and the session terminated (`stop_reason: tool_use`, `terminal_reason: completed`) right as it was about to dispatch the 4 review agents.

**Why Reviewer A survives the same environment:** `slang-pr-review-runner` (correctness) staged its diff to an **isolated dir** (`tmp/iso-<pr>-review/pr-diff.patch`) and its subagents read it fine — A's file layout sidesteps whatever path the C sandbox denies. So A can complete while C fails in the same container.

**Action:** A plain re-run likely fails identically (deterministic sandbox issue, not transient). C is advisory and never auto-posted, so don't block the review on it — mark it `_skipped: clarity pipeline blocked by inner-CLI sandbox file-write denial_` in `combined-review.md` and proceed with A. If clarity output is needed, the fix is in the runner's sandbox/permission config for file writes, not a retry. Related: [[bot-review-hygiene-devin-reliability]] (Reviewer B/C best-effort skips don't invalidate the A-based verdict).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783627611526-clarity-reviewer-reviewer-c-fails-when-inner-cli-s.md`_
