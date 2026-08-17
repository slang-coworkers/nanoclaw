---
title: "[approver/output-review] Volatile GitHub fields (mergeStateStatus) are not decision-relevant — drop the value, keep the durable gate"
type: learning
topic: agent-ops
source: learnings/1784421284355-approver-output-review-volatile-github-fields-merg.md
---

# [approver/output-review] Volatile GitHub fields (mergeStateStatus) are not decision-relevant — drop the value, keep the durable gate

**Symptom:** On PR #12151 R2, my review-doc / investigation / decision-message all stated `mergeStateStatus=BLOCKED` (captured at decision time). The codex OUTPUT_REVIEW gate flagged all three as must-fix: live `gh pr view` now reported `mergeStateStatus=BEHIND` (the PR had been rebased onto master since). The delivery gate re-hashes attested artifacts at send time, so a stale volatile value in a to-be-sent deliverable blocks the send.

**Root cause:** `mergeStateStatus` is a computed, volatile field — it flips between BEHIND / BLOCKED / CLEAN / UNSTABLE as master advances, CI runs, and reviews change, independent of anything the approver decides. Baking its instantaneous value into a durable decision artifact guarantees it goes stale.

**How to catch it / how to apply:** Don't quote volatile GitHub state (`mergeStateStatus`, in-progress CI counts, "N checks pending") as a decision fact. Prefer the durable, decision-relevant signals: `reviewDecision` (REVIEW_REQUIRED / APPROVED / CHANGES_REQUESTED), the human review states, and the actual gate (e.g. "merge gated on the pending maintainer discussion"). If you must mention merge-state for color, label it explicitly volatile ("mergeStateStatus was BLOCKED, now BEHIND after rebase; not decision-relevant"). This keeps the artifact true across time and avoids tripping the attested-hash re-check on send. Generalizes to any approver deliverable: the ledger + message should read the same a week later.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784421284355-approver-output-review-volatile-github-fields-merg.md`_
