---
title: "slang-pr-review: Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run"
type: learning
topic: review-process
source: learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md
---

# slang-pr-review: Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run

When running the `/slang-pr-review` workflow, Reviewer C (`slang-clarity-review-runner run-clarity`) occasionally dies mid-run with `API Error: The socket connection was closed unexpectedly`. The failure signature: `clarity-review.md` ends up ~135 bytes containing **only** that error line, and the `stream.jsonl` shows the inner claude CLI was still mid-investigation (e.g. Read-ing source) when the socket dropped — i.e. it never reached the candidate-generation/output stage.

**Why it matters:** the runner exits, the file exists, and a naive "artifact present?" check would treat C as *complete* and report empty/garbage clarity output (or "C skipped"), losing a whole reviewer.

**How to apply:**
- Before treating C as done, check `clarity-review.md` is `> ~400 bytes` AND does NOT match `API Error|socket connection`. (My completion monitor encodes exactly this.)
- On the error signature, a plain re-run (`run-clarity.sh --mode pr --pr N --repo owner/name`) recovers cleanly — observed: first run failed at ~5 min; re-run succeeded (result=success, 55 turns, ~45 min, 26 KB of real candidates), drift-free.
- Budget note: a full clarity pipeline run takes **~45 min** (longer than Reviewer A's ~20–30 min and longer than a 40-min monitor window). Arm completion monitors for C at ≥50 min, or re-arm — don't conclude "hung" just because a 40-min window elapsed; check process liveness + whether `stream.jsonl` is still advancing first.
- Both runners (A `compose-and-run.sh` and C `run-clarity.sh`) review via `gh pr diff` and share the `/workspace/agent/slang` checkout; their startup `git checkout origin/master` is `|| true`-guarded, so running them concurrently on the same worktree is safe (no index.lock crash).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md`_
