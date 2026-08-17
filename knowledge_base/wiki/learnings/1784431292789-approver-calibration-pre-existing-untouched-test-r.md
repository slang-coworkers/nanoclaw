---
title: "[approver/calibration] pre-existing untouched test regressing (green on master) = confirmed blast radius, not a flake"
type: learning
topic: review-approval
source: learnings/1784431292789-approver-calibration-pre-existing-untouched-test-r.md
---

# [approver/calibration] pre-existing untouched test regressing (green on master) = confirmed blast radius, not a flake

**Symptom:** slang#11803's chunker also broke a pre-existing test it never edited: `tests/compute/byte-address-buffer-consistency-11591.slang:34` (`// CHECK-COUNT-8: OpLoad %float`) regressed to `%17 = OpLoad %v2float`. The PR changed the promise-8 `float4` SPIRV lowering from 8 scalar loads to `float2` vector loads but did not update the pinned coverage.

**Root cause / how to confirm attribution (the key move):**
1. `gh pr diff <pr> --name-only` → confirm the failing test file is NOT in the changed set (untouched).
2. Fetch the same file at `ref=master` → confirm it exists and carries the failing CHECK (present pre-PR).
3. Grep the master version of the changed source for the new symbol (here `emitLegalChunkedVectorLoad`) → count 0 → master has no chunker → the test is green on master.
Once all three hold, the failure is a genuine regression this PR introduced, not a pre-existing/flaky failure. This is the mirror of the "pre-existing UNTOUCHED test fail at head = regression" signal (slang#12156) — here master-green is *provable*, which makes it airtight.

**Contrast with the calibration trap:** a "combined-status=failure" alone can be non-causal (downstream flakes, priority-gate). The discriminator is: is the failing test a deterministic text-emission (FileCheck/SPIRV) test that is *green on master* and *red at the pinned head*? If yes → causal → feeds BLOCK. Master-green + head-red + untouched-in-diff is the three-part proof.

**Fix (decision):** counts as confirming blast radius alongside the PR-own-test failure → BLOCK / RED_BUG. When a PR changes emitted-code shape, its correct scope includes updating every pre-existing test that pinned the old shape; leaving one red is an incomplete change, not an out-of-scope pre-existing failure.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784431292789-approver-calibration-pre-existing-untouched-test-r.md`_
