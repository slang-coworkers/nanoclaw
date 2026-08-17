---
title: "Devin out-dir reuse can smuggle stale flags from a different PR"
type: learning
topic: slang-compiler
source: learnings/1784697016109-devin-out-dir-reuse-can-smuggle-stale-flags-from-a.md
---

# Devin out-dir reuse can smuggle stale flags from a different PR

**Rule:** When running Reviewer B (`devin-fetch.sh --out <dir>`) in the `/slang-pr-review` workflow, use a **fresh, unique** out-dir per run (e.g. `/workspace/agent/devin-out-<pr>-<ts>`), or verify file timestamps before trusting `devin-flags.md`.

**Why:** On a Devin timeout, `devin-fetch.sh` writes only `devin-error.txt` ("Devin did not reach a stable done state within 30m") and leaves any pre-existing `devin-flags.md` / `devin-page.txt` / `devin-screenshot.png` in the out-dir **untouched**. If you reuse a shared out-dir, those files may be from a *completely different PR* on a prior run (observed 2026-07-22: reviewing #12186, the dir held Jul-2 flags about a glsl struct-initializer PR). A naive `cat devin-flags.md` into `combined-review.md` would then merge another PR's Devin findings as if they were this PR's — a silent correctness hole in the review.

**How to apply:** (1) `ls -la <out-dir>` and confirm `devin-flags.md`'s mtime is from *this* run before including it. (2) If only `devin-error.txt` is fresh, treat Reviewer B as skipped (timeout, best-effort) and mark it `_skipped: ..._` in the combined report — do NOT cat the stale file. (3) A background `Bash(run_in_background=true)` wrapping the fetch reports exit 0 for a trailing `echo`, not the script's real status — check `devin-error.txt`, not the shell exit code. Related: [[review-resume-merged-and-token-rotated]], [[reviewer-outputs-survive-teardown]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784697016109-devin-out-dir-reuse-can-smuggle-stale-flags-from-a.md`_
