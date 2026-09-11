---
title: "slang-pr-review-runner: concurrent runs race on shared REPO_ROOT tmp/pr-diff.patch → false INTEGRITY-FAIL"
type: learning
topic: slang-compiler
source: learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md
---

# slang-pr-review-runner: concurrent runs race on shared REPO_ROOT tmp/pr-diff.patch → false INTEGRITY-FAIL

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789051888262-ecwy2r
written_at: 2026-09-10T15:24:36.664Z
---

# slang-pr-review-runner: concurrent runs race on shared REPO_ROOT tmp/pr-diff.patch → false INTEGRITY-FAIL

## Symptom
Reviewer A (`slang-pr-review-runner compose-and-run.sh`, `--mode pr`) exits **nonzero (1)** with a `<run_dir>/INTEGRITY-FAIL.txt` saying "reviewed diff != PR files" — listing files from a **completely different PR** (e.g. raypayload files while reviewing a matrix-layout PR) — even though the produced `final-review.md` is verifiably 100% about the correct PR (correct file:line cites, 0 mentions of the wrong PR's files).

## Root cause
`compose-and-run.sh` (and `run-clarity.sh` before its worktree isolation) default `REPO_ROOT=/workspace/agent/slang` — the **shared** checkout. Its diff-integrity guard writes/reads `$REPO_ROOT/tmp/pr-diff.patch` and `tmp/context.json`. When a **second review run** (a different coworker session / a2a agent) launches against the same container's shared checkout while the first is mid-flight, the two runs **race on the same `tmp/` files**: the later run's `gh pr diff > tmp/pr-diff.patch` clobbers the first run's copy. The first run's *end-of-run* integrity guard then re-reads the clobbered `tmp/pr-diff.patch`, sees the other PR's files, and trips INTEGRITY-FAIL. The review itself is usually unaffected (the model got the right diff via its own live `gh pr diff <N>` calls early on), so this is typically a **false positive** — but it must NOT be hand-waved, because a genuine wrong-diff review looks identical from the exit code alone.

## Diagnosis (how to tell false-positive from real)
1. `grep -ic '<correct-topic>' final-review.md` vs `grep -ic '<wrong-topic>'` — a clean run is all-correct-topic, zero wrong-topic.
2. `grep -il '<wrong-topic>' <run_dir>/subagents/*` — clean run: no hits.
3. Check for a concurrent run: `ls -dt <skill>/transcripts/pr-*` — a second dir with a later timestamp whose `stream.jsonl` is still growing and has no `final-review.md` = still running, clobbering shared tmp/.
4. `ls -la /workspace/agent/slang/tmp/pr-diff.patch` mtime falls *inside* your run window; its content is the other PR.

## Mitigation (the fix)
Re-run Reviewer A in an **isolated git worktree**, exactly as Reviewer C already does:
```
git -C /workspace/agent/slang worktree add --detach /workspace/agent/wt-<pr>-reviewA origin/master
REPO_ROOT=/workspace/agent/wt-<pr>-reviewA bash <skill>/scripts/compose-and-run.sh --mode pr --pr <N> --repo <owner/repo>
```
The worktree gives the run its own `tmp/`, immune to concurrent runs. `compose-and-run.sh` honors `REPO_ROOT` (`${REPO_ROOT:-/workspace/agent/slang}`); a worktree of `origin/master` carries REVIEW.md + `.claude/agents/` so the run works unchanged. Name it `wt-<pr>-<tag>` so supervise-issues GC reaps it.

## Suggested durable fix (proposal, not yet done)
`slang-pr-review-runner`'s `compose-and-run.sh` should isolate into a per-run worktree by default (like `run-clarity.sh`), instead of using the shared checkout — this eliminates the race at the source.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md`_
