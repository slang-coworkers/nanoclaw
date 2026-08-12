---
title: "[approver/calibration] pre-existing-untouched-test-failing-at-head-is-regression-even-without-base-green"
type: learning
topic: review-approval
source: learnings/1784420632496-approver-calibration-pre-existing-untouched-test-f.md
---

# [approver/calibration] pre-existing-untouched-test-failing-at-head-is-regression-even-without-base-green

## Symptom
On PR #12156 I found 3 `test-slang` legs FAILING at the pinned head (`generate-cuh-header.slang`, identical FileCheck diff on linux-debug-aarch64 / linux-release-aarch64 / macos-release). I wanted a master-head baseline (is the test green on master?) to call it a "regression," but the OneCLI gh proxy was flapping (repeated `app_not_connected` 401s) and master's check-runs for that SHA weren't reachable. Risk: stall the BLOCK waiting for a baseline I couldn't get.

## Root cause / principle
A base-green baseline is the IDEAL evidence for the word "regression," but it is NOT required to BLOCK when three conditions hold together:
1. the failing test is a **pre-existing committed** test (verify: it's in the local clone / `git log` shows it predates the PR; here added in commit 73697735);
2. the PR **does not modify** that test file (confirm via `gh pr diff --name-only`);
3. the diff touches **exactly the code path the test exercises** (here the `__extern_cpp` decoration arm, and the test is full of `__extern_cpp` decls).
Under those three, a deterministic same-diff failure at the pinned head is attributable to the PR. codex (DECISION_REVIEW) explicitly ruled the unconfirmed baseline a soft-gap, not a must-fix, for this reason.

## How to catch / apply
- Always disambiguate CI "failure" by cause before using or discarding it. Here `check-ci`'s "failure" was the `wait-for-human-priority` **priority-gate yield** ("higher-priority CI is active; ci-retry-yielded-bot will rerun when quiet") — a NON-causal infra event. The block basis was the separate `test-slang` regression, not `check-ci`. (Reinforces the memory-index rule: "failure" ≠ non-success; read the failed step's log.)
- When the proxy flaps, don't chain foreground `sleep` (blocked) — use a background `until` poll (`run_in_background:true`) for the nice-to-have baseline and proceed with the decision if the causal chain already stands. Don't let a flaky nice-to-have gate a well-supported BLOCK.
- Record the baseline limitation explicitly in the decision message's Blocker line so the audit trail shows it was a known, mitigated gap — not an overlooked one.

## Fix
Blocked on the 3-condition attribution + reproduced 3-platform failure; disclosed the missing baseline as mitigated. Human COLLABORATOR had approved same head — a SAFE-direction disagreement (I block, human approves); annotate severity (build-breaking test regression, not example/doc-only) so it reads as expected-safe, per the [[pr-11471-decided]] lesson.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784420632496-approver-calibration-pre-existing-untouched-test-f.md`_
