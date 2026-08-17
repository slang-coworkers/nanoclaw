---
title: "[approver/challenger] A default-value fix whose existing test SETS that field explicitly: the test is the MASK that hid the bug, not coverage"
type: learning
topic: review-approval
source: learnings/1785936477454-approver-challenger-a-default-value-fix-whose-exis.md
---

# [approver/challenger] A default-value fix whose existing test SETS that field explicitly: the test is the MASK that hid the bug, not coverage

**Symptom.** slang-rhi#813 fixes `createBufferFromNativeHandle` to call `fixupBufferDesc(desc)` on Vulkan/D3D12, so an imported buffer stops keeping `defaultState == Undefined`. There is an existing GPU test for exactly this path — `tests/test-buffer-from-handle.cpp`, `GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan | Metal)` — and it passes both before and after. It is tempting to read that as "the path is covered."

**Root cause.** `test-buffer-from-handle.cpp:24` sets `bufferDesc.defaultState = ResourceState::UnorderedAccess` **explicitly**. `fixupBufferDesc` (`src/resource-desc-utils.cpp:58-65`) only writes `defaultState` when it is `Undefined`, so on that test the function is an **exact no-op**. The test carries ZERO bits about the changed behavior — and that is also *why the defect survived for months*: the only test of the path sets the optional field, so the default-value path where the fixup matters was never exercised.

**How to catch it.** When a PR fixes behavior on a **default-value path** (a struct field left at its default, an omitted option, an unset flag), do not stop at "is there a test for this function?" Open the test and check whether it **sets the very field whose default is at issue**. If it does:
- the passing test is not weak coverage, it is the **mask** that hid the bug;
- "the existing test passes" is a **false-safe** — the observation could not have come out otherwise;
- the honest coverage statement is "no test distinguishes this change from its absence."

This is the same shape as the recorded siblings *test-mask registration is not test execution* and *skip-direction tests pass more easily, not less*: in all three the artifact is structurally incapable of discriminating. Ask the standing question — **could this observation have come out differently if the fix were wrong?**

**Fix.** Record the missing trigger-present control explicitly (a case leaving `defaultState` at its default and asserting the derived state). Then scope its severity by the change's failure direction rather than reflexively charging `OPEN_GAP`. In #813 it stayed a **nit** and the decision was WOULD_APPROVE, because the changed code is 2 lines calling an existing pure 6-line helper already used by 7 other call sites, monotone (byte-identical desc unless `defaultState == Undefined`), with the dangling-temporary risk refuted at source (`rhi-shared.cpp:53-58` copies by value; `core/struct-holder.h:17-24` deep-copies the label). The distinguishing test for "can I clear this by reading?" is not "did I read the source?" but **"is the change small and monotone enough that reading EXHAUSTS the state space?"** — contrast slang-rhi#802, where a large new bindless implementation was source-verified-correct and still failed once executed.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785936477454-approver-challenger-a-default-value-fix-whose-exis.md`_
