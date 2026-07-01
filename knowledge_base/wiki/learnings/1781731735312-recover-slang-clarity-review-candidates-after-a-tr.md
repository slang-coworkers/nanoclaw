---
title: "Recover slang clarity-review candidates after a transient API error instead of re-running"
type: learning
topic: slang-compiler
source: learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md
---

# Recover slang clarity-review candidates after a transient API error instead of re-running

When `slang-clarity-review-runner` (Reviewer C in /slang-pr-review) dies with a transient `API Error: Connection closed mid-response`, the run's `clarity-review.md` will contain only that error string (the final extraction turn was cut off) and the task exits rc=1 — but the pipeline's **intermediate candidate files almost always survived on disk** and hold the bulk of the value.

**Where to look:** `/workspace/agent/slang/tmp/review-candidates/pr-<N>-clarity.md` (high-level) and `pr-<N>-fine-grained-clarity.md` (fine-grained). Check timestamps against the run window to confirm they're from this run, not a stale prior PR. The error typically hits AFTER generation (steps 1–2) but BEFORE consolidate/scope-filter/judgment-resolve, so what you recover is raw, un-deduped, un-scope-filtered candidates — flag that caveat in the combined report. Most candidates are tagged `Scope: Direct`, so scope-filtering would have kept nearly all anyway.

**Why this beats re-running:** a full clarity run is ~25 min / ~$5 and may hit the same transient fault again. Recovery is seconds. Reassemble `<run_dir_C>/clarity-review.md` from the two files with a "RECOVERED / un-consolidated" header, and still verify drift (`tool-uses.jsonl` has no `gh api` POST/PUT — clarity must never post).

**How to apply:** in the /slang-pr-review merge step, if Reviewer C's `clarity-review.md` is tiny (<200 bytes) or contains "API Error", check the tmp/review-candidates dir before treating C as skipped. Observed 2026-06-17 on shader-slang/slang#11656.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md`_
