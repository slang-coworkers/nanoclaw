---
title: "[approver/challenger-miss] A fix that closes YOUR OWN finding is the least-scrutinized diff you will read — and a per-item predicate needs a per-item check"
type: learning
topic: review-approval
source: learnings/1786273668817-approver-challenger-miss-a-fix-that-closes-your-ow.md
---

# [approver/challenger-miss] A fix that closes YOUR OWN finding is the least-scrutinized diff you will read — and a per-item predicate needs a per-item check

## Symptom

slang-rhi#817 R1 (`4aec3cbeb8c5`). At R0 I abstained (`OPEN_GAP`) because the PR
advertised two new `TextureUsage` bits (`ShaderResource`, `CopySource`) that
`configure()` never validated against the format. The author's next push added
exactly those two checks. I read them, confirmed both existed, and proposed
**WOULD_APPROVE**. `DECISION_REVIEW` returned MUST-FIX; I re-verified in source
and the critique was right — the new `CopySource` check is **wrong**.

## Root cause

Two distinct failures, both mine, both in the same paragraph:

**1. Per-item predicate verified for one item, generalized to its sibling.**
I *did* check the enum mapping — for `ShaderResource`. `FormatSupport::ShaderLoad`
comes from `VK_FORMAT_FEATURE_2_SAMPLED_IMAGE_BIT` on **`optimalTilingFeatures`**
(`src/vulkan/vk-device.cpp:1682`, inside `if (otf)` at `:1675`), so it is the
correct guard for an optimal-tiled swapchain image (and `ShaderSample` would have
been wrong — that's filter-linear, `:1683`). Having confirmed one, I asserted the
pairing was correct and moved on.

`FormatSupport::CopySource` is derived from **`linearTilingFeatures`**:

    vk-device.cpp:1668   VkFormatFeatureFlags ltf = props2.formatProperties.linearTilingFeatures;
    vk-device.cpp:1671   UPDATE_FLAGS(ltf, VK_FORMAT_FEATURE_2_TRANSFER_SRC_BIT, FormatSupport::CopySource);

Swapchain images are optimal-tiled — the same file pins
`imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL` at `:1694`. So the new check at
`vk-surface.cpp:420` gates an optimal-tiling usage on a linear-tiling feature. A
format with `TRANSFER_SRC` in `optimalTilingFeatures` but not
`linearTilingFeatures` (legal Vulkan; `linearTilingFeatures` is frequently `0`)
makes `configure()` return `SLANG_E_INVALID_ARG` for a configuration `init()` had
just advertised as supported. **New code — it does not exist at base.**

The two flags sit on **adjacent lines** (`:1671`/`:1672`) and read identically
apart from the `_SRC`/`_DST` suffix. Adjacency and visual symmetry are what made
the generalization feel already-done.

**2. The fix arrived pre-argued because I wrote the requirements.** A diff whose
commit message is your own finding restated ("Validate ShaderResource/CopySource
usage per format…") triggers verification of *presence*, not *correctness*. I
checked that the checks appeared where I said they should.

## How to catch it

- **When an author fixes exactly what you flagged, review the fix as a NEW
  change.** Your prior finding is not a warrant for the code that answers it. The
  question is never "did they add the check I asked for" but "is the check they
  added right".
- **A predicate audit is per-item. Verifying one member of a set and carrying the
  result to its siblings is the "one instance ⇒ the class" error.** If you check
  which data source feeds flag A, check it for B too — especially when they are
  adjacent and look symmetric, which is precisely when you will skip it.
- For any `FormatSupport::X` used to gate a **swapchain/optimal-tiled** image in
  slang-rhi, confirm which tiling field populates X: `CopySource`/`CopyDestination`
  come from `linearTilingFeatures` (`vk-device.cpp:1671-1672`) while
  `ShaderLoad`/`ShaderSample`/`ShaderUavStore`/`RenderTarget` come from
  `optimalTilingFeatures` (`:1678-1688`). The two `Copy*` flags are the trap.
- "Fails closed" (reject-valid rather than admit-invalid) **lowers blast radius; it
  does not make a wrong predicate inconsequential.** It still rejects a config the
  API advertised, which is a functional regression.

## Fix

Recorded **ABSTAIN_POLICY / `OPEN_GAP`** at `4aec3cbeb8c5` rather than
WOULD_APPROVE. Flips to approve if `FormatSupport::CopySource` is re-derived from
`optimalTilingFeatures` for this use, or the `:420` check is dropped in favour of
the caps mask already at `:271`.

Note the calibration both ways: the R0 abstain **worked as a request** — both R0
gaps were genuinely fixed within ~7 minutes, and the author's chosen fix for gap 2
(intersecting the default with `m_info.supportedUsage`) was **better than the
cross-backend pattern I had cited**, because it cannot auto-add storage usage and
so preserves the `#765`/#762 intent documented at `:388-392`. An abstain is a
request, not a hedge — and a cross-backend pattern is a candidate, not the answer.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786273668817-approver-challenger-miss-a-fix-that-closes-your-ow.md`_
