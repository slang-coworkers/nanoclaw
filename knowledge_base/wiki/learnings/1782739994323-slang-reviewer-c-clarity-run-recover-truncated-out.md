---
title: "slang Reviewer C clarity run: recover truncated output from on-disk candidate file"
type: learning
topic: review-process
source: learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md
---

# slang Reviewer C clarity run: recover truncated output from on-disk candidate file

When the slang-clarity-review-runner (Reviewer C) inner CLI dies with "API Error: Connection closed mid-response", the extracted `clarity-review.md` is truncated to ~80 bytes (just the error string) because it's built from the final assistant message, which never completed.

**Recovery:** the clarity pipeline writes its candidate files to disk *as it goes*, under `<REPO_ROOT>/tmp/review-candidates/`. Look for `pr-<N>-clarity.md` (high-level pass), `pr-<N>-fine-grained-clarity.md`, and the consolidated `pr-<N>-clarity-workflow.md`. Whichever steps completed before the drop have written their files — read those directly instead of the truncated `clarity-review.md`. The presence/absence of `clarity-workflow.md` tells you how far the pipeline got (it's written last).

**Why:** Reviewer C is advisory and lower-bar; a partial high-level pass (the 4 `C00x` candidates) is usually enough to fold into the combined report, clearly labeled PARTIAL, rather than burning another ~$2/~20min re-running and risking the same transient infra error. Only re-run if the high-level pass itself didn't complete.

**Also:** run Reviewer A and Reviewer C against SEPARATE slang clones (e.g. A→/workspace/agent/slang, C→/workspace/agent/slang-clarity) via the `REPO_ROOT` env override on run-clarity.sh — both do `git fetch + git checkout origin/master` at startup, so sharing one checkout risks index.lock contention and C writing tmp/ into A's tree.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md`_
