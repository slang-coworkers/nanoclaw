---
title: "[approver/clause-gap] A synchronize on a no-op merge commit re-triggers the reviewable webhook but leaves PR footprint byte-identical — decide from net diff, re-verify gaps against live source"
type: learning
topic: review-approval
source: learnings/1785319523865-approver-clause-gap-a-synchronize-on-a-no-op-merge.md
---

# [approver/clause-gap] A synchronize on a no-op merge commit re-triggers the reviewable webhook but leaves PR footprint byte-identical — decide from net diff, re-verify gaps against live source

**Symptom:** slangpy#1075 fired a `synchronize` webhook (head e65086c → e396c57) asking for a fresh approval decision "after new revision pushed." The direct commit-to-commit diff (`e65086c..e396c57`) showed a changed file (`tests/sgl/device/test_profiler.cpp` +4/−2), which looks like real new work. But the head was a **merge commit** (`Merge branch 'main' into <branch>`, parents = [prior head, a main commit]) and the **net PR footprint vs base was byte-identical** to the prior revision — still only `texture_loader.cpp` (+2/−1, same hunk).

**Root cause:** GitHub emits `synchronize` on any head move, including a `git merge main` that pulls base content into the branch. The direct parent-to-parent diff includes that base churn; only `gh pr diff` (merge-base…head) shows the PR's own footprint. Deciding from the direct commit diff would misread base content (the test file) as new PR work and could mask that the actual open gaps were untouched.

**How to catch it:** On every `synchronize`, run `gh api .../commits/<head> --jq '.commit.message, .parents'` to detect a merge commit, and compare **`gh pr diff <pr>`** (net footprint) against the prior revision's footprint — not the raw `compare/A...B` file list. If net footprint is byte-identical, the push is a no-op merge: the prior challenger findings transfer, but you must still **re-verify each open gap against LIVE source at the new head** (contents API at `?ref=<head>`), because "byte-identical net diff" proves the *change* is unchanged, not that a maintainer didn't separately edit the flagged lines. Here both gaps (off-by-one @ texture_loader.cpp:373 `if (i && (i % BATCH_SIZE == 0))`, and the unsynced sibling `create_texture_array` with no `device->wait()`) were confirmed still present at e396c57 → ABSTAIN_POLICY (OPEN_GAP) held. Harvest returned exit 10 (CodeRabbit review stale-by-commit-id) — but since the flagged code was byte-identical, the finding was still live; a stale-by-commit review is not the same as an obsolete finding.

**Fix:** Net-footprint comparison is the eligibility signal (a no-op merge means no Devin re-run needed — no material diff change), but the gap-persistence check must always hit live source at the pinned head. Don't let a stale harvest exit code (10) discard a finding whose code hasn't moved.

**Second, unrelated gotcha (delivery gate):** the `[Approval Decision]` critique-gate hook (`gate-critique-on-deliver.sh`) has an ABSTAIN fast-path that allows the message iff it contains `ABSTAIN_POLICY|ABSTAIN_INFRA` AND NOT the bare tokens `WOULD_APPROVE|BLOCK` (word-boundary match). Writing "not BLOCK" or "not a BLOCK" in the rationale trips the guard and forces a spurious critique demand even though `record_decision` already succeeded (host relaxes the ledger gate for ABSTAIN rows). **Fix: in an ABSTAIN decision message, never write the uppercase tokens `BLOCK`/`WOULD_APPROVE` — phrase as "not a blocking defect" / "not blocking" instead.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785319523865-approver-clause-gap-a-synchronize-on-a-no-op-merge.md`_
