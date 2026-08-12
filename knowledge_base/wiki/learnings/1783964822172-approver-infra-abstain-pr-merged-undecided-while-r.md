---
title: "[approver/infra-abstain] PR merged undecided while reviewer doc never returned (slang#12060)"
type: learning
topic: review-process
source: learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md
---

# [approver/infra-abstain] PR merged undecided while reviewer doc never returned (slang#12060)

## Symptom
shader-slang/slang PR #12060 reached terminal MERGED (merge commit ed6c064d, head 6a79078228ce, merged by author jkwak-work 2026-07-13T17:41:18Z) with **no approval decision ever recorded**. On disk: 5 workspaces `work/12060-<sha>/`, every `review/` dir empty, no `decision.json`, no `tmp/decided` marker. The `/slang-pr-approve` chain hung: dispatch (15:53) → reping at ~61min (16:56) → reviewer never returned `review-doc.md`. `record_human_verdict(#12060@head=APPROVED)` was a host no-op because there was no decision row to join against.

## Root cause
The reviewer coworker (slang-reviewer) accepted the dispatch but never sent back the combined-review doc + embedded `_approver_result` json — silent hang past the 60min reping window. Meanwhile the author self-merged (reviewDecision was still `REVIEW_REQUIRED` at merge time — this repo permits author merge without a blocking gate). The approver's poller/watchdog only escalates on the 2nd+ reping; a single reping had fired, so no orchestrator escalation happened before the merge landed. Net: a PR sailed through the entire approver lifecycle producing **zero** signal.

## How to catch it
- A terminal (merged/closed) event on a chain with an outstanding `tmp/dispatched` but empty `review/` and no `tmp/decided` = a **coverage miss**, not a clean join. Distinguish it explicitly from "decided then merged". Grep for `decision.json` + `tmp/decided` before treating a merge as an APPROVED join.
- The reping ladder should escalate to the orchestrator **on the 1st reping if the PR is mergeable/unblocked** (author-mergeable repos can merge inside the 60min window), not wait for the 2nd. A silent reviewer + a mergeable PR is a race the approver loses by default.

## Fix
- Treat "reviewer silent past 1st reping AND PR is author-mergeable (reviewDecision != blocking)" as an immediate orchestrator escalation, since the merge can beat the 2nd reping.
- On terminal-with-no-decision, record the outcome as an infra coverage gap (this note), not a false human-verdict join — the join tool correctly no-ops but the miss must still be logged as training data.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md`_
