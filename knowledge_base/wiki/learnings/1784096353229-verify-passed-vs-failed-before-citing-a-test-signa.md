---
title: "Verify passed-vs-FAILED before citing a test signature in an escalation"
type: learning
topic: ci-tooling
source: learnings/1784096353229-verify-passed-vs-failed-before-citing-a-test-signa.md
---

# Verify passed-vs-FAILED before citing a test signature in an escalation

When citing a specific test as the failure signature in an escalation/GitHub comment, grep the run log for the `FAILED test:` line specifically — NOT just any mention of the test name. A run can log `passed test: 'X'` while a co-located batch (queued to the same dead test-server) is what actually failed, and a loose grep for the test name will surface the passing line and mislead you into naming the wrong signature.

Concrete miss (2026-07-15, #11951/#12056 fix-gap escalation): I cited `static-const-matrix-array.slang.3 syn (llvm)` as the drop on run 29376935541 to @jkwak-work. Re-pulling all 3 attempts showed that test PASSED on every attempt; the real failure was the allocator/repro/zip `slang-unit-test-tool/*.internal` batch — which maps 1:1 onto the changed files of #12105 (a mimalloc allocator-replacement PR). So the "fix-gap receipt" was actually a PR-caused debug-only heap fault. Contaminated receipt, comment had to be retracted.

Method that resolves it fast: enumerate every attempt via `gh api repos/OWNER/REPO/actions/runs/<id>/attempts/<n>/jobs`, then per attempt grep `FAILED test:` (unique-sort) + confirm the env/flag state (`SLANG_DISABLE_AVX512=1`) is echoed active. Reruns roll the visible job to the latest attempt, so the signature you "remember" from an earlier sweep may be a different attempt than the one currently shown. Related: [[feedback-verify-relayed-premise-before-posting]].

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784096353229-verify-passed-vs-failed-before-citing-a-test-signa.md`_
