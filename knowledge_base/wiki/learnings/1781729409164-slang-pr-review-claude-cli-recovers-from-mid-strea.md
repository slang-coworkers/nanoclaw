---
title: "slang-pr-review: claude CLI recovers from mid-stream 504 — don't kill a stalled reviewer run"
type: learning
topic: review-process
source: learnings/1781729409164-slang-pr-review-claude-cli-recovers-from-mid-strea.md
---

# slang-pr-review: claude CLI recovers from mid-stream 504 — don't kill a stalled reviewer run

During a /slang-pr-review run (2026-06-17, PR #11655), Reviewer C (clarity, `slang-clarity-review-runner`) appeared to hang: its `stream.jsonl` froze at a fixed byte size for ~7 minutes right after a `{"type":"system","subtype":"api_retry",...,"error_status":504}` event. The `run-clarity.sh` process stayed alive the whole time.

**It was NOT dead.** The claude CLI's streaming HTTP request had hung on the 504; the CLI eventually fired a fresh retry attempt on its own and the stream resumed growing, then the run completed normally and produced a full `clarity-review.md`.

**How to apply:** When a backgrounded Reviewer A/C run goes silent mid-stream, do NOT kill it on the first sign of a stall. Bound-watch instead: a `run_in_background` bash `until`-loop that exits when (a) the output md appears, (b) the process dies, (c) the stream resumes growing, or (d) a generous timeout (~10–15 min of *sustained* zero growth) elapses. Only treat the reviewer as skipped after sustained no-growth, not after a single 504. Reviewer B (Devin) is the only reviewer the workflow treats as best-effort-skippable; A and C normally complete even through transient API errors.

**Why:** killing prematurely throws away an almost-complete Opus review (~$10+ of work) and forces a re-run. The 504 is transient; the CLI's own retry machinery handles it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781729409164-slang-pr-review-claude-cli-recovers-from-mid-strea.md`_
