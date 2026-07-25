---
name: ""
description: "slang#10842 DescriptorHandle support on Metal; re-triaged 07-24; parked maintainer-owned GPU-gated"
metadata: 
  node_type: memory
  type: project
  title: "#10842 Metal DescriptorHandle runtime — re-triaged/PARKED"
  tags: 
    - slang
    - slang-rhi
    - metal
    - descriptorhandle
    - bindless
    - parked
    - jhelferty-nv
  originSessionId: 86f30980-8c62-4d53-a4a7-5114a82df6ab
---

# shader-slang/slang#10842 — DescriptorHandle support on Metal

**State (2026-07-24):** Re-triaged @HEAD 5281ccc66 / slang-rhi 29dc332e. feature/medium/P2,
component = slang-rhi Metal **runtime**. **PARKED at triaged — no fixer dispatch.**
Maintainer-assigned (jhelferty-nv). Human triage labels untouched.

## Trigger
jhelferty-nv webhook comment (5073070319): "triage this again… we will **not** support
DescriptorHandle for the **combined texture sampler** case (doesn't fit expected bits),
but I'd expect the **other cases** to be possible."

## Verdict (empirically grounded)
- **Two-layer conflation resolved:** Metal **compiler/emit** side ALREADY supports
  `DescriptorHandle<T>` (unwrapped to native layout, `slang-emit-metal.cpp:148`) — no compiler
  work needed. The real gap is the **slang-rhi runtime**: Metal backend has zero
  `getDescriptorHandle` overrides (all inherit `SLANG_E_NOT_AVAILABLE`), never advertises
  `Feature::Bindless`. `git log -S` over 200+ commits confirms never landed (the "was added"
  claim in closed #11540 referred to the emit side).
- **Combined-case carve-out is well-founded:** `DescriptorHandle.value` = one `uint64_t`.
  Metal combined tex+sampler needs 2×64-bit gpuResourceIDs (128b) → won't fit (D3D12 only fits
  by packing 32-bit heap indices). Separate buffer/texture/sampler each = one 64-bit native id
  → feasible. Combined stays out of scope (tracked closed as **#11540**).

## Fix path (if maintainer says go — GPU/macOS-only, NOT validatable on our Linux env)
New metal-bindless-descriptor-set + Feature::Bindless + 3 getDescriptorHandle impls + enable
Metal in 3 test-bindless cases. **Approach A** (raw native-id) recommended; B buffer-first.
Full memo: `/workspace/agent/memory/triage-10842.md` (triager's fs) — file:line pointers.

## FIX AUTHORIZED + shipped-to-draft (07-24)
Maintainer jhelferty-nv: "Go ahead and prepare a PR" (comment 5073791718) → dispatched slang-fixer.
**Draft PR: shader-slang/slang-rhi#802** (Fixes slang#10842), `pr: non-breaking`, report_pr_created done.
- Approach A1 exactly: new Metal BindlessDescriptorSet (raw-id, NO heap/allocator/residency);
  Feature::Bindless under existing ArgumentBufferTier2 gate; getDescriptorHandle overrides on Metal
  buffer/texture-view/sampler/AS. Handle value = raw gpuAddress (buffers) / gpuResourceID()._impl
  (tex/sampler/AS) — verified vs arg-buffer consumer (metal-shader-object.cpp:562/523/546/588).
  Combined stays NOT_AVAILABLE (#11540 not reopened). 15 files +209/-2.
- Tests: Metal enabled on bindless-buffers + bindless-textures. Local build clean (exit 0); Metal
  runtime path is **macos-latest CI only** (backend doesn't compile on Linux) — CI running.
- codex gate all-green; peer review → slang-reviewer (fixer's edge, ≤2 rounds).
- Issue footprint: slang#10842 comment 5074412823.
- **GATE:** draft→ready + merge OPERATOR-gated; fixer won't flip ready. Webhook-driven follow-up.

### Review (07-24, head 3a4001d): APPROVE_WITH_NITS
3-reviewer pass (A correctness / B Devin clean / C clarity) all concur. 0 bugs, 2 gaps, 2 Qs —
**none blocking**. Load-bearing native-id equivalence VERIFIED byte-for-byte (MTL::ResourceID =
{uint64_t _impl}, 8B → handle == arg-buffer consumer value for buf/tex/sampler/AS); Metal in both
test masks. Verdict delivered to fixer (fixer's edge — fixer owns weighing nits, ≤2 rounds).
- **G1** (weigh): bindless-only textures not made resident in the non-default `!m_hasResidencySet`
  fallback (page-fault risk; default Apple6+ path safe) — wire it OR document the dependency.
  NB maintainer waived per-handle residency bookkeeping, so "document the dependency" likely fine.
- **G2**: AS handle untested on ALL backends (pre-existing, not this PR's regression).
- Clarity nits: unused m_device/m_desc; undiscoverable combined-tex+sampler rationale; optional
  static_assert on ResourceID size.
- NOT posted to GitHub (no human @-authorization; file-only per workflow). Combined report:
  inbox/a2a-1784929020941-htkmsu/combined-review-802.md.
- Workflow note: slang-rhi ≠ compiler repo → Reviewer A/C runner skills (hard-wired to /slang +
  REVIEW.md) couldn't run faithfully; reviewer adapted (Devin native, A/C general-domain same
  lenses vs real slang-rhi checkout, load-bearing claims independently verified). Flagged for
  transparency. **Fixable-gap for future slang-rhi reviews.**

## Maintainer design confirmation (07-24, comment 5073561417; ack 5073581253)
jhelferty-nv **blessed Approach A** + 3 design points folded into memo:
1. Handle value = **RAW native id/address** (gpuAddress/gpuResourceID), NOT an allocated/heap
   index — no Vulkan/D3D12-style allocator.
2. **Residency/lifetime = API-user's responsibility** (unified-memory "alive⇒resident");
   runtime does NO per-handle residency bookkeeping (retires earlier hazard-tracking tradeoff note).
3. slang-rhi already has **paravirtual-macOS Metal-CI handling** upholding the contract →
   macOS CI runtime coverage viable when a fix lands.
STILL PARKED — design confirmation, NOT a "make a PR" authorization.

## Artifacts / routing
- Verified 5-bullet posted: issue comment **5073225961** (fresh comment; prior was maintainer's).
- Adjacent: **#11970** (Metal bindless MSL, compiler-side, separate). Combined = **#11540** (closed).
- Same posture as [[project_slang_rhi_800_metal_dispatch_indirect]] /
  [[project_slang_rhi_801_metal_buffer_import]] / [[project_12142_metal_rayquery_trianglefrontface]]
  — Metal-HW-gated, macOS CI would be only runtime coverage.
- **RELEASE:** jhelferty-nv / operator says "make a PR" → dispatch slang-fixer on thread
  `gh-issue-shader-slang/slang-10842` (Approach A).
