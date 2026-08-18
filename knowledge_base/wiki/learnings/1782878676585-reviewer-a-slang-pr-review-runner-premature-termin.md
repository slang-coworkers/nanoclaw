---
title: "Reviewer A (slang-pr-review-runner) premature-termination signature: exit-0 but incomplete"
type: learning
topic: review-process
source: learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md
---

# Reviewer A (slang-pr-review-runner) premature-termination signature: exit-0 but incomplete

## What happened

Running `slang-pr-review-runner compose-and-run --mode pr` (Reviewer A / correctness) on shader-slang/slang#11870, the FIRST run reported `completed (exit code 0)` in ~52s but was a **failed/incomplete run**:
- `final-review.md` = **96 bytes** — a mid-thought fragment ("These are stale (from a different PR). Let me overwrite both..."), not a review.
- Result event: `num_turns: 13`, `stop_reason: "tool_use"`, `terminal_reason: "completed"`, cost only $0.85.
- **0 subagents dispatched** — the 6-subagent REVIEW.md pipeline never started. The model burned its early turns on the known `mkdir tmp` / `> tmp/pr-diff.patch` permission-denial dance (see SKILL.md "mkdir/redirect retry dance" gotcha) and the session ended before dispatching subagents.

A plain **re-run of the identical command** produced a full, healthy review: 70 turns, $12.77, `stop_reason: end_turn`, 6155-byte `final-review.md`, all 6 subagents ran, drift-clean.

## Reusable rule

A Reviewer A background job completing `exit 0` is **NOT** proof of success. Before trusting `final-review.md`, verify:
1. `wc -c final-review.md` — healthy is multi-KB; **<500B = failed** (either the API-Error/socket crash already in shared learnings, OR this new *premature tool_use termination at a low turn count* with no API error).
2. Subagents actually ran: `grep -oE "subagent_type|code-quality-reviewer|ir-correctness-reviewer" <run>/stream.jsonl | sort | uniq -c`. **Zero `subagent_type` mentions = the pipeline never dispatched → re-run.** (Do NOT rely on `tool-uses.jsonl` for this — its extraction can come out empty even on a healthy run; grep the raw `stream.jsonl` instead.)
3. Check the tail result event for `num_turns` — a full review is dozens of turns; ~13 turns + `stop_reason:tool_use` = premature stop.

Remedy: **re-run compose-and-run once.** The premature termination is transient (not a config/preflight problem) — the same command succeeded on the second try. Only escalate to "Reviewer A failed, rely on B/C + manual read" if a second run also terminates early.

## Also confirmed this session
- Reviewer B (Devin) on a **draft** PR: `devin-commit-status.txt = "unknown"` + `devin-flags.md` starts with "Generating..." and the "AI Analysis" body is just the echoed PR description. `Bugs (none)`/`Flags (none)` is a **false all-clear** — label B INCOMPLETE, exclude from finding counts. (Matches prior learning; held exactly.)
- Reviewer C isolation: pointing C at `REPO_ROOT=/workspace/agent/slang-clarity` (a separate git **worktree**, own index) avoids the `.git/index.lock` race with A on `/workspace/agent/slang`. Worked; both ran fully in parallel.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md`_
