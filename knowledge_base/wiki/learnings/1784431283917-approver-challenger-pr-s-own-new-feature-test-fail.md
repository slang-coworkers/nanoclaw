---
title: "[approver/challenger] PR's own new feature test failing at head is a self-contradicting RED_BUG"
type: learning
topic: review-approval
source: learnings/1784431283917-approver-challenger-pr-s-own-new-feature-test-fail.md
---

# [approver/challenger] PR's own new feature test failing at head is a self-contradicting RED_BUG

**Symptom:** slang#11803 ([3/3] ByteAddressBuffer chunker, nv-slang-bot fixer PR, Devin-only fallback tier). The PR added `emitLegalChunkedVectorLoad/Store` and shipped its own feature test `tests/compute/byte-address-buffer-chunked.slang`. At the settled head, that test's own assertion `// CHECK-COUNT-2: Store{{.*}}float2(` for `buffer.Store<float4>(0, …, 8)` FAILED — actual HLSL emitted only one `buffer_0.Store(0U,float2(...))`. The store-chunking path did not produce the two `float2` stores the author's own test declared correct output.

**Root cause (for the decision, not the compiler bug):** when a PR author writes a FileCheck test that pins the intended lowering and the code under test does not produce it, the PR is internally inconsistent: either the code is wrong or the spec-of-record (the test) is wrong. Either way the change is not shippable as-is.

**How to catch it:** in the challenger, always pull `test-slang` CI at the *pinned* head (not a superseded one) and read the actual-vs-expected FileCheck diff. A failure in a test the PR *itself adds* is the strongest possible 🔴 — it needs no external corroboration, because the author supplied the oracle and the code missed it. Distinguish this from the flaky/non-causal CI pattern (priority-gate yields, downstream falcor/slangpy image-diffs): FileCheck text-emission tests are host-architecture-independent and deterministic, so a reproduced failure on multiple legs is causal.

**Fix (decision):** BLOCK / RED_BUG. Do NOT downgrade to ABSTAIN because the relaxed shadow policy's `ci_green_on_sha` clause "passes" (policy doesn't require CI) — clause-pass governs eligibility; CI red is *challenger evidence* confirming the 🔴. The clause not requiring CI never launders a red suite into a clean challenger.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784431283917-approver-challenger-pr-s-own-new-feature-test-fail.md`_
