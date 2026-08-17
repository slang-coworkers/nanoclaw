---
title: "Recovering a teardown-stranded PR-review pass without a full re-run"
type: learning
topic: review-process
source: learnings/1784536666918-recovering-a-teardown-stranded-pr-review-pass-with.md
---

# Recovering a teardown-stranded PR-review pass without a full re-run

When the orchestrated slang-pr-review runner (Reviewer A / `compose-and-run.sh`) is stranded by session teardown, you often do NOT need a full ~25-min re-run. Recover in layers:

1. **Salvage completed reviewers first.** Devin (B) artifacts persist at `/workspace/agent/review-<pr>/devin/devin-flags.md`. Clarity (C) run dirs under `slang-clarity-review-runner/transcripts/` can be GC'd after days — but if you already read its `clarity-review.md` into context earlier, you have the content; reconstruct it into a file rather than re-running.
2. **Recover partial A verdicts from the dead run's `stream.jsonl`.** Extract the driver's per-subagent `result` summaries: `python3 -c` over the jsonl, filter `type=="result"` with `len(result)>60`. The first run's 600s inner background-wait ceiling often truncates AGGREGATION while the individual subagents already reported — so 4/6 verdicts are usually recoverable verbatim.
3. **Re-run ONLY the missing dimensions in-turn** as direct `Agent()` calls (code-quality-reviewer, cross-backend-reviewer, documentation-accuracy-reviewer, etc.). Direct Agent calls complete in-turn — no teardown window — unlike background bash tasks which die on container recycle.

**Two infra failure modes to root-cause, not paper over:**
- **REVIEW-GUARD FAIL (<500B final-review.md):** inner `claude --print` hit the 600s background-wait ceiling ("Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely"). Fix: re-run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 bash compose-and-run.sh ...`.
- **INTEGRITY-FAIL "reviewed WRONG diff":** a STALE `tmp/pr-diff.patch` from a prior different-PR review left in the repo root. The inner model's `gh pr diff > tmp/pr-diff.patch` was permission-denied (multiline command didn't match the allowlist glob), so it never overwrote the stale file; the guard compared stale→current and fired. `pr-diff.reference` in the run dir shows what was ACTUALLY targeted. Fix: `rm -f slang/tmp/pr-diff.patch` before re-running.

**Checkout gotcha:** the local `/workspace/agent/slang` worktree usually sits on base master, NOT the PR head. To reason about real post-PR code, `git fetch origin pull/<n>/head` then read via `git show <head>:<path>` — do NOT trust the working-tree file (it lacks the PR changes; subagents told to "read the file at current state" get base code + must rely on the diff).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784536666918-recovering-a-teardown-stranded-pr-review-pass-with.md`_
