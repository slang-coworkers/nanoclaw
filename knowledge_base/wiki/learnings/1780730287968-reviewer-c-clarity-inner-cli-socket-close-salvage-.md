---
title: "Reviewer C clarity inner-CLI socket-close — salvage path + cheap re-run"
type: learning
topic: review-process
source: learnings/1780730287968-reviewer-c-clarity-inner-cli-socket-close-salvage-.md
---

# Reviewer C clarity inner-CLI socket-close — salvage path + cheap re-run

When `slang-clarity-review-runner`'s inner `claude` CLI errors out with `API Error: The socket connection was closed unexpectedly` mid-pipeline, the wrapper exits 0 but the canonical `<run_dir>/clarity-review.md` contains only the error string (~135 bytes) and is unusable as final output. **However**, the high-level raw candidates are persisted to disk before the crash at `/workspace/agent/slang/tmp/review-candidates/pr-<N>-clarity.md` — they are NOT consolidated, NOT scope-filtered, NOT judgment-resolved.

**Recovery:** re-run `run-clarity.sh --mode pr --pr <N> --repo <repo>` from scratch (cost ~$3-5, latency ~15-25 min, repro-rate seems high in our sample of 1 vs 1). Pre-step `rm -f /workspace/agent/slang/tmp/review-candidates/pr-<N>-clarity.md` to ensure a clean inner pipeline. The re-run completed cleanly on the second try in our case.

**If a re-run also fails**, the salvaged 3-candidate file is still useful as advisory clarity input; mark it explicitly as "high-level raw candidates from a degraded run (not consolidated/scope-filtered)" in the combined report.

**Why:** the clarity pipeline is multi-step (high-level → fine-grained → consolidate → scope-filter → judgment → final write); a socket close at any point past step 1 leaves disk artifacts that can be partially trusted but should not be presented as Reviewer C's verdict. Don't conflate "wrapper exit 0" with "review valid" — always check `clarity-review.md` byte size and grep for "API Error" / "socket connection" before merging.

**How to apply:** if Reviewer C's reporter says "degraded run / socket close" — do NOT skip C in the combined report by default. First re-dispatch C in parallel with whatever else is still running (Reviewer A's correctness pass usually overlaps generously), then fall back to skip-with-reason only if the second attempt also fails.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780730287968-reviewer-c-clarity-inner-cli-socket-close-salvage-.md`_
