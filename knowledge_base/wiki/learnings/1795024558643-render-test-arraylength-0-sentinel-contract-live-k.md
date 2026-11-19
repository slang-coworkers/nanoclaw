---
title: "render-test arrayLength 0-sentinel contract; live Khronos VUID repro via chromium layer; two-round review pattern"
type: learning
topic: review-process
source: learnings/1795024558643-render-test-arraylength-0-sentinel-contract-live-k.md
---

# render-test arrayLength 0-sentinel contract; live Khronos VUID repro via chromium layer; two-round review pattern

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795014915231-yf3qob
written_at: 2026-11-18T17:55:58.643Z
---

# render-test arrayLength 0-sentinel contract; live Khronos VUID repro via chromium layer; two-round review pattern

slang#14593 / PR #14596 (2026-11-18) — durable notes for render-test texture-classification work:

1. **`InputTextureDesc::arrayLength`'s 0-sentinel is now the documented contract** (shader-input-layout.h, mirroring mipMapCount): 0 = unspecified → non-array; any positive value = explicit array even of one element (honored for 1D/2D/MS/cube; 3D ignores the field — the dimension-3 arm of `ShaderRendererUtil::createTexture` never consults isArray); only TEST_INPUT parsing writes the field. Reviewers held every layer of this to exact wording: "debug-layer" is D3D terminology, Vulkan's is "validation layer"; and classification happens host-side once — don't attribute it to SPIR-V emit paths.

2. **A live VUID repro is achievable in any container with the L40S**: the Khronos validation layer ships inside chromium's directory (`/usr/lib/chromium/libVkLayer_khronos_validation.so`); a hand-written `VkLayer_khronos_validation.json` manifest under the workspace + `VK_LAYER_PATH` + `slang-test -enable-debug-layers true` fires VUIDs that the bare driver silently accepts. This turned a "cannot reproduce locally" triage into a live 0/2 repro + a verifier-replicated revert experiment (revert only the fix → the new 2D test fails 0/2 with the exact VUID).

3. **Review-cycle cost control on small PRs**: two rounds produced APPROVE_WITH_NITS. The gaps were coverage-shaped ("the change is broader than its tests") — adding the dx11/dx12/cuda legs and a companion 2D test closed them; declines survived when justified at the mechanism level (1D/MS take the identical isArray branch) rather than by preference. Declines belong in the report/PR prose, never in source comments.

4. **Delivery-gate mechanics (second confirmation)**: each new inbound task re-arms plan+critique gates with fresh stage counters; the plan is only recorded by a `Write` tool call under reports/ (an `Edit` doesn't count); every required stage needs its own fresh codex call carrying `STAGE:`; codex-reply continuations must never carry a STAGE line; and any file edit between approve and send re-arms the gate — so write the final deliverable first, critique last, send unchanged.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795024558643-render-test-arraylength-0-sentinel-contract-live-k.md`_
