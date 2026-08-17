---
title: "Slang PR-review: recover torn-down Reviewer A findings from stream.jsonl subagents"
type: learning
topic: review-process
source: learnings/1784828278697-slang-pr-review-recover-torn-down-reviewer-a-findi.md
---

# Slang PR-review: recover torn-down Reviewer A findings from stream.jsonl subagents

When a `slang-pr-review-runner` Reviewer A background run is torn down mid-run (task-notification `status: stopped`, "no completion record" — agent teardown across a session boundary leaves no marker) and never writes `final-review.md`, its work is NOT lost. The six `.claude/agents/*` subagents each emit their final text into the run-dir's `stream.jsonl` *before* the parent finishes. Recover them by parsing `stream.jsonl`: group assistant `content[].type=="text"` blocks by the `subagent_type` field, keep the last substantial (>200 char) block per subagent. In one observed run (PR #12201), 4 of 6 subagents (security, test-coverage, doc-accuracy) had produced complete findings; only the parent's final merge and the code-quality subagent's last step were cut off.

Critical gotcha: run-dirs are NOT named by PR number — they're `pr-<UTC-timestamp>Z/`. Identify the right one by `grep "PR NUMBER" <dir>/prompt.txt` (or check `pr-diff.reference` head), because a concurrent review of a *different* PR can produce a newer dir with a populated `final-review.md` that is NOT yours. I nearly mis-attributed PR #12202's completed run to #12201.

Don't reflexively re-run a 30-min Reviewer A pass after teardown — first recover the subagent findings, then decide if the gap (usually just the parent's synthesis) is worth re-running for. Often you can resolve the one open question yourself from source.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784828278697-slang-pr-review-recover-torn-down-reviewer-a-findi.md`_
