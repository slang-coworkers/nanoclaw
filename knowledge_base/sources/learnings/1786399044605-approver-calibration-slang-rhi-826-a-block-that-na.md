---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T21:57:24.605Z
---

# [approver/calibration] slang-rhi#826: a BLOCK that names a mechanism at file:line got fixed in 4 hours — and reversing to approve on the next revision is correct, not inconsistent

## What happened

R1 of slang-rhi#826 (`7453b287db06`) was reproducibly red: 144 test failures on both
Linux clang legs, all Vulkan device-creation, preceded by
`libnvidia-tls…: cannot allocate memory in static TLS block` and
`loader_icd_scan: Failed loading … libGLX_nvidia.so.0`. I recorded **BLOCK:RED_BUG**
with a *named, file:line-anchored* hypothesis: the PR's new test tears down all cached
devices mid-run, so repeated Vulkan driver load/unload exhausts glibc's static-TLS
surplus and the loader drops the NVIDIA ICD.

~4 hours later the author pushed R2 (`4eccd3fbe8f3`, "Retain Vulkan module") touching
*only* `src/vulkan/vk-backend.{h,cpp}`: the Vulkan loader module and `VkInstance` used
for adapter enumeration are retained for the backend lifetime instead of being destroyed
at the end of `enumerateAdapters()`. Its own comment: *"prevents Vulkan ICDs from being
unloaded and reloaded between devices. Some Linux drivers cannot reliably be reloaded
after other GPU libraries have consumed the static TLS surplus."*

At R2 every check is green: `855 | 855 passed | 0 failed` on both previously-red legs.

## The two transferable lessons

**1. A blocking finding that names a mechanism is actionable; one that names a symptom
is not.** "CI is red, please look" would have produced a re-run. "144 Vulkan
device-creation failures, all after this specific test, preceded by these two loader
warnings, and here is the teardown call at file:line that plausibly causes it" produced
a targeted 43-line fix on the first attempt. The extra work of tracing to a mechanism is
what converts a block from an obstacle into a hand-off. And when the fix lands *on that
mechanism*, that is the strongest available confirmation the call was right — far
stronger than the block merely "sticking".

**2. Reversing your own verdict on a new revision is the procedure working, not a
wobble.** The revision-chain rule says prior turns are context, never evidence — and it
cuts *both* directions. It is obvious that a clean R1 must not carry forward to excuse a
dirty R2. The less obvious half: a *dirty* R1 must not carry forward as residual
suspicion of R2. **Rounding a resolved 🔴 forward is exactly as wrong as rounding an
unresolved one down** — both substitute a remembered position for evidence at the pinned
head. Re-derive every clause, count, and log; then say plainly that the earlier position
was about the earlier head.

## What made the R2 approve safe rather than relieved

Do not accept "CI went green" as the fix. Green is the symptom clearing; a fix is only
verified when the **failure signature** disappears and the code reads correctly:

- **Signature, not symptom.** The `static TLS block` / `loader_icd_scan` warnings that
  preceded every R1 failure went from 5 per leg to **0**. That is the named mechanism
  going away, not just the assertions passing. Also check adjacent state: 3
  `surface-*.vulkan` cases that had flipped SKIPPED→FAILED at R1 returned to SKIPPED.
- **Read the lifetime, don't infer it.** Verified by source: the pin is established on
  the path that matters (`DeviceImpl::initialize` → `initVulkanDevice` →
  `backend->getAdapters()` → `ensureAdapters()`, a `std::call_once`); release is
  idempotent (`VulkanModule::destroy()` guards on `isInitialized()`); the retain flag is
  set only after full success so early returns still clean up; and teardown order is safe
  because `RHI::destroy()` asserts `m_liveDeviceCount == 0` *before* releasing backends.
  A "retain this longer" fix has exactly three failure modes — double-free, leak, and
  destruction-order — so check all three explicitly.
- **Know what green cannot see.** `SLANG_RHI_ENABLE_REF_OBJECT_TRACKING` is hard-coded
  `0` in `src/core/smart-pointer.h`, so the leak detector is **compiled out** of CI: a
  retained `VkInstance` is precisely the shape a leak check would flag, and CI does not
  check. Critically, **zero leak lines in the log is not evidence** — the *green base*
  log also has zero. Silence from an absent instrument looks identical to a pass.
- **Name the workaround honestly.** This fix accommodates external driver fragility
  rather than eliminating it, which the author's comment concedes. That is a legitimate
  accommodation and a fair maintainer discussion, but it should be stated, not smoothed
  over, in the approve.
