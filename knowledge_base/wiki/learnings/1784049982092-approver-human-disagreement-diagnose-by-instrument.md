---
title: "[approver/human-disagreement] 'Diagnose-by-instrumentation' PRs that re-enable a quarantined test are ABSTAIN_POLICY when the test is still red"
type: learning
topic: review-approval
source: learnings/1784049982092-approver-human-disagreement-diagnose-by-instrument.md
---

# [approver/human-disagreement] "Diagnose-by-instrumentation" PRs that re-enable a quarantined test are ABSTAIN_POLICY when the test is still red

**Class of signal (transferable):** A PR framed as *"instrument X to diagnose a CI failure"* that ALSO removes a quarantine/expected-failure entry (re-enabling the flaky test) is a two-intent PR. The instrumentation half is usually clean and low-risk; the re-enable half is the decision driver. Probe it directly: does the un-quarantined test actually pass on the pinned head?

**#12009 instance:** examples/gpu-printing/main.cpp gained a correct rhi::IDebugCallback + enableValidation + failure-path reportError (0 bugs, and the callback demonstrably emitted the diagnostic that named the failing stage — the stated goal achieved). But the same PR removed `macos:aarch64:...:gpu-printing` from tests/expected-example-failure-github.txt, and the re-enabled example failed on the pinned head (kernels.slang(19) `[[required_threads_per_threadgroup(32,1,1)]]` needs Metal 4.0; runner reported `GPUFamilyApple6 not supported` = sub-4.0; exit 255; `ci-examples.sh` has no retry). Root-cause #11973 was open+worsening; the driving issue #11999's own checklist required "confirm gpu-printing passes reliably" BEFORE removing the line. Decision: ABSTAIN_POLICY / OPEN_GAP.

**What to check for this shape, next time:**
1. Read the driving issue's acceptance checklist — a "re-enable once X is fixed" item means the re-enable is premature if X isn't closed. Check the root-cause issue's *state* (open/worsening?), not just its existence.
2. Confirm the re-enabled test's ACTUAL result on the pinned head (find the exact CI job that runs it — for slang examples that's `test-macos-release-clang-aarch64 / test-slang` step "Run Slang examples", full-gpu-tests+release+pull_request only; NOT the build job). A red there = demonstrated OPEN_GAP trigger, not hypothetical.
3. Distinguish retry-havers from non-retry runners: the slang-test step retries 3×, the examples step does not — a signature that "recovers" in one can be a hard fail in the other.
4. Devin's narrative is DATA, not authority: on #12009 Devin claimed the metal4.0 signature belonged to "a different green test" — the CI log showed gpu-printing failing directly in its own kernel. Cross-check narrative claims against the primary log.

**Calibration note:** maintainer explicitly requested the re-enable the same day. A human directing the re-enable is exactly why this is ABSTAIN_POLICY ("human must look") rather than an auto-approve — but in shadow mode "would I auto-approve a knowingly-red macOS check right now?" is NO. Watch the merge/review join: if a maintainer merges WITH macOS still red (e.g. via admin override to collect diagnostics), that's a human accepting a conservative-abstain, not a false-safe — record agreement, don't round toward approve.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784049982092-approver-human-disagreement-diagnose-by-instrument.md`_
