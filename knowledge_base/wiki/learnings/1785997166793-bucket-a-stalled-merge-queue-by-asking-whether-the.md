---
title: "Bucket a stalled merge queue by asking whether the failing gate is REQUIRED"
type: learning
topic: agent-ops
source: learnings/1785997166793-bucket-a-stalled-merge-queue-by-asking-whether-the.md
---

# Bucket a stalled merge queue by asking whether the failing gate is REQUIRED

## A merge-queue-only gate red can look like a flake wave and be one config line

2026-08-06 sweep, shader-slang/slang. Six consecutive `merge_group` failures of
`Check Submodule Pointers` (`.github/workflows/check-submodules.yml`, workflow_id **271590667**)
across five unrelated PRs (12352, 12322, 12353, 12357, 12309) read like an infra flake wave. It was a
**clean state change**: last green `2026-08-05T21:19:58Z`, red from `22:33:19Z` onward, because
`microsoft/mimalloc` flipped its default branch `main` → `main3` and slang's pin
`8c532c32c3c9` is not reachable from `main3`. Fix is one line in `.gitmodules`
(`branch = v2.1.7`) — landed as PR **#12381**, whose `check-submodules` job is green.

**Three traps this sequence sets, all of which cost me a wrong read at least once:**

1. ⛔ **`paths:` filters are IGNORED for `merge_group`.** So a gate that never fires on
   `pull_request` for most PRs fires on **every** queue entry. Consequence: the gate is invisible in a
   head-checks-only sweep and looks like "a flake hitting random PRs" in the queue. If a failing job
   appears only on `gh-readonly-queue/...` branches, check the workflow's `on:` block before
   classifying.

2. ⛔ **Resolve a workflow_id from a RUN you already have, never by name-matching the workflows
   list.** I read the gate's history off `workflow_id=304182095` and got 20 rows of clean `success` —
   that id is **REUSE Compliance Check**, whose only job is `reuse-compliance-check`. The rows were
   real, green, and about a different gate; the id was wrong, so the answer was a confident false
   green. Cheap guard: print the job names alongside each run (`jobs[].name`) and confirm the job you
   care about is actually in there. A run history with none of your job in it is a wrong-id tell, not
   a pass. Correct id came from `gh api /actions/runs/<known-run-id> --jq .workflow_id`.

3. ⛔ **A non-required gate is NOT an eviction cause — compare timestamps, don't infer.** This gate is
   absent from `check-ci`'s `needs:`, so it fails while the PR merges anyway (proof: on merge-group sha
   `49584a0890d3` the gate failed 22:34Z and PR 12352 merged 23:52Z). It also postdated the
   12353/12322 evictions. A wake payload had already used this gate's run to claim #12357 was evicted
   when `RemovedFromMergeQueueEvent` was empty and the PR sat at queue position 1.

**How to apply:** when several queued PRs fail the same job, ask in order — (a) is it `merge_group`-only
(`paths:` bypass)? (b) is it in `check-ci`'s `needs:` i.e. actually blocking? (c) does the failure have
a sharp last-green boundary (state change) rather than an interleaved pass/fail ratio (flake)? A sharp
boundary + a non-required gate + an external dependency that moved = **rerun cannot succeed**, don't
spend a cap; find or file the one-line fix instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785997166793-bucket-a-stalled-merge-queue-by-asking-whether-the.md`_
