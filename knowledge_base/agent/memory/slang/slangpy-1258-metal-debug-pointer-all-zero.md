---
type: chain
title: slangpy#1258 — intermittent macOS Metal Debug pointer tests return all-zero results
description: Human-filed (tdavidovicNV) 2026-11-03 ~06:02Z while validating #1257/#1256 (public-module work). test_vectorize_buffer_of_pointers / test_raw_buffer_of_pointers [metal] read back all zeros on macOS Debug, intermittently. Routed to slangpy-triager on gh-issue-shader-slang/slangpy-1258, no hold.
tags: [slangpy, metal, macos, ci, flake, pointers, slang-rhi]
---

# slangpy#1258 — Metal Debug pointer tests read back all zeros

- **Filed** 2026-11-03 by tdavidovicNV (human); no labels, no comments, unassigned at dispatch. R6: no hold.
- **Symptom (reporter's account):** macOS Debug job on #1257 head `135d6078` failed
  `test_vectorize_buffer_of_pointers[metal]` with all 500 outputs 0; Release passed. Same fixture passed
  on combined head `3144b207`. An earlier #1256 run failed `test_raw_buffer_of_pointers[metal]` the same way.
  Base commit passed. No compile diagnostic. slang-rhi `a521c01d`, Slang 2026.20, macos-26-arm64.
- **Reporter's lead:** Metal backend residency-set vs per-encoder fallback path; the fallback resolves
  reflected uniform pointer fields but does not discover pointers stored inside buffer contents.
- **Related:** #1256 / #1257 are the same author's public-module / 2026 migration work;
  [slang#14231](14231-tensor-interface-diff-extension-e33180.md) blocks #1256. Not the same symptom.
- **Routing (11-03):** `grep 1258` over memory found only unrelated numeric hits; no triager session existed
  (only my own Main session on this thread). Dispatched slangpy-triager. Our fleet has no macOS/Metal,
  so a reproduction is not possible here; triage is source analysis + Vulkan/CUDA controls.

## Triage (11-03 06:29Z) — the triager's finding; source lines verified by me

- Triage comment 6597045643 posted by nv-slang-bot 06:28:46Z (verified). Memo:
  `/workspace/inbox/a2a-1793687382956-8jopwp/1258-metal-pointer-in-buffer-residency-all-zero.md`.
- **Leading hypothesis (not confirmed):** slang-rhi `a521c01d` Metal per-encoder `useResource` fallback.
  `BindingDataBuilder::resolvePointerFieldResidency` (`src/metal/metal-shader-object.cpp:716`) returns early
  when `m_hasResidencySet`; otherwise it scans only uniform pointer fields, so a buffer whose address sits
  inside another buffer (Tensor of pointers) is never made resident. **I verified this code and the
  `metal-device.cpp` selection** (`SLANG_RHI_METAL_NO_RESIDENCY_SET` env or `!supportsFamily(GPUFamilyApple6)`).
  The two flaky tests are the only Metal tests with a pointer stored inside a buffer.
- Unverified: that GitHub's macOS runners actually take the fallback (only commit text from rhi #727/#725).
  The reason the failure is intermittent is not explained. Release 0/4 vs Debug 2/5 is not explained either.
- L40S Vulkan/CUDA control: 0 failures across ×50/×20 runs in 3 modes (not a Metal test).
- Classified bug/medium/P2, SGL + upstream slang-rhi Metal. Recommended A (diagnostics on macOS CI), then
  B (fallback `useResources` over all live buffers) only if a failing run shows `residency_set == False`.
- **Parked** on tdavidovicNV (diagnostics A). Triager one-shot `t-be5a18` 11-06 06:30Z (in the triager's
  group; `ncl tasks get` from Main can't see it).
- **My decision (11-03):** no slang-rhi filing yet. It is not reproduced and the hypothesis is unconfirmed. File/route B only after a
  failing run shows the fallback path. Operator told on orchestrator-dashboard.
