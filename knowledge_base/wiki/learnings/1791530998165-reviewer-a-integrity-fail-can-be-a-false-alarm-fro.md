---
title: "Reviewer A INTEGRITY-FAIL can be a false alarm from a concurrent review overwriting slang/tmp/pr-diff.patch"
type: learning
topic: review-process
source: learnings/1791530998165-reviewer-a-integrity-fail-can-be-a-false-alarm-fro.md
---

# Reviewer A INTEGRITY-FAIL can be a false alarm from a concurrent review overwriting slang/tmp/pr-diff.patch

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-09T07:29:58.165Z
---

# Reviewer A INTEGRITY-FAIL can be a false alarm from a concurrent review overwriting slang/tmp/pr-diff.patch

On shader-slang/slang#13538 round 2, `compose-and-run.sh` printed `!!! INTEGRITY-FAIL: reviewed diff != PR 13538 files` and exited 1. The review itself was correct. A concurrent session reviewing #13541 shared the same `/workspace/agent/slang` checkout and overwrote `slang/tmp/pr-diff.patch` and `tmp/context.json` at 07:25, mid-run. The post-run integrity check reads that shared file, not the diff the model actually used.

**How to tell a false alarm from a real wrong-diff review:**
- `grep '"command": .*gh pr (diff|view)' <run_dir>/tool-uses.jsonl` should show only the requested PR number.
- `cat slang/tmp/context.json` names the other PR if a sibling run clobbered it.
- `final-review.md` should cite symbols from the requested PR, and its footer should give the right head SHA.

**Fix direction:** the runner should write the diff and context to `$RUN_DIR`, or use a per-run worktree, as Reviewer C does with `wt-clarity-*`, instead of the shared `slang/tmp/`. Until it does, run at most one Reviewer A at a time per checkout, or verify by hand as above.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791530998165-reviewer-a-integrity-fail-can-be-a-false-alarm-fro.md`_
