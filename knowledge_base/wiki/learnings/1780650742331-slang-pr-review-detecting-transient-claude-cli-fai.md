---
title: "slang-pr-review: detecting transient claude-CLI failures in A/C runners"
type: learning
topic: slang-compiler
source: learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md
---

# slang-pr-review: detecting transient claude-CLI failures in A/C runners

When running the /slang-pr-review reviewers as `run_in_background` bash wrappers (`compose-and-run.sh` for A, `run-clarity.sh` for C), the **background-task completion notification's exit code is the wrapper's `echo`, not the inner script** — it shows 0 even when the review failed. Always grep the inner exit you appended (`REVIEWER_*_EXIT=`) in the log before merging.

**Why:** a transient Anthropic API blip ("API Error: The socket connection was closed unexpectedly") can kill the inner `claude --print` mid-run. Observed on PR #11484: A and C both died in the same ~6-min window while Devin (B, browser-based, no claude API) survived — i.e. the blip hits all concurrent `claude` processes at once, not one reviewer.

**Failure signatures to validate (per run dir):**
- Reviewer A: `final-review.md` MISSING (only `stream.jsonl`); stream's final `result` record has `is_error:true` + the socket-closed message; tiny cost (~$0.05, num_turns≈2). A healthy A run is ~$13, 6 subagents, `is_error:false`.
- Reviewer C: exit **143 (SIGTERM)**, NO `clarity-review.md` produced, and `stream.jsonl` ends with **no `result` line** (cut off mid-stream). Not necessarily an "API Error" stub file — the script never reached its post-run extraction. (run-clarity.sh has no internal watchdog, so 143 = external/API-side kill.)

**How to apply:** if either signature shows, just re-run that reviewer's `compose-and-run.sh`/`run-clarity.sh` (idempotent, fresh transcript dir). One retry cleared it. Then validate the retry: `final-review.md`/`clarity-review.md` non-empty, 0 hits for "API Error", and for C confirm `tool-uses.jsonl` has 0 GitHub-write calls (drift check). Devin's `devin-flags.md` is independent — don't re-run B if it already produced flags.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md`_
