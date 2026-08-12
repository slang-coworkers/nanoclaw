---
title: "slang-pr-review Reviewer A: 600s bg-wait ceiling truncates final-review.md — recover from stream.jsonl"
type: learning
topic: review-process
source: learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md
---

# slang-pr-review Reviewer A: 600s bg-wait ceiling truncates final-review.md — recover from stream.jsonl

**Symptom:** `slang-pr-review-runner compose-and-run` (Reviewer A) exits 1 with `REVIEW-GUARD FAIL: final review is <500 bytes`, and the log shows `Background tasks still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely.` The inner `claude --print` CLI has a 600s background-wait ceiling that kills the six review subagents (and the final file-write) before `final-review.md` is populated. `subagents/` ends up empty and `final-review.md` is a stale mid-analysis stub.

**This is an infra timeout, NOT a "0 findings" verdict.** Do not report the guard-file's 477-byte stub or the summarizer's `🔴0/🟡0/🔵0` inline-regex counts as the review result — those regex counts only parse the (empty) final file, not the subagents' work.

**Recovery (worked on PR #11987, 2026-07-13):** the main agent's *complete* final synthesis usually IS in `stream.jsonl`, just never flushed to disk. Extract it:
1. Parse `stream.jsonl` (JSONL), collect `type=="assistant"` messages where `subagent_type is None` (the MAIN agent). Concatenate their `content[].text` blocks; the real review is the last block containing `**Verdict**`.
2. Also group by `subagent_type` + `task_description` to see which reviewers finished (e.g. test-coverage/ir-correctness/security had multi-KB final blocks; cross-backend/code-quality were cut off).
3. Verify integrity before trusting: no `INTEGRITY-FAIL.txt` in run dir; `sha256sum run_dir/pr-diff.reference` matches the diff_hash in the run-dir name and the review footer; `grep -cE "gh api.*(POST|PUT).*/reviews|createReview"` on `tool-uses.jsonl` == 0 (drift); PR head still == reviewed commit.
4. Write the recovered synthesis to `final-review.md`, and add a provenance run-note to `combined-review.md`. Set `reviewers_complete:false` in RESULT_JSON.

**Prevention:** the runner honors `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (wait indefinitely) — export it before `compose-and-run.sh` for large/slow reviews so the final aggregation isn't guillotined. Trade-off: no upper bound on wall-clock, so pair with `--max-budget-usd`.

**Why:** saves the next reviewer from a false-negative report or a needless $30/30-min re-run when a complete, integrity-verified review already exists in the stream.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md`_
