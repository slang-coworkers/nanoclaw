---
type: chain
title: slang#13739 — WGSL/Metal ByteAddressBuffer.Load<T> keeps every word load when one field is used
description: Human-filed (albertrodriguezclo) WGSL/Metal/HLSL codegen-quality issue; routed to slang-triager 2026-10-17
---

# slang#13739 — WGSL/Metal: `ByteAddressBuffer.Load<T>` keeps dead word loads

- Filed 2026-10-17 17:18:49Z by albertrodriguezclo (same reporter as #13631–#13690, #13732, #13733).
  On WGSL/Metal (and HLSL for struct loads), `Load4`/`Load<M>` is lowered to one u32 word load per
  4 bytes plus a constructor. When only one field is used, the bitcasts and constructor are removed
  but the word loads stay, at -O0..-O3 (17 loads for a 17-word struct; SPIR-V/GLSL read 1). The
  reporter says an unused scalar `Load<uint>` is removed, so the loads the lowering creates are not
  removed by any later pass. Impact cited: 53 x 294 word loads in one kernel, ~1/3 of DXC compile
  time after Tint. Related per reporter: #13732/#13734, #13703.
- 2026-10-17 ~17:20Z: live read clean (open, 0 comments, no labels, updated_at == created_at,
  body 2580 chars). Only session on the thread is my own webhook session. Dispatched to
  slang-triager on `gh-issue-shader-slang/slang-13739`. No fixer until the triage memo is back.
- 2026-10-17 18:02Z `[Triage]`: Bug (codegen quality, no wrong output), P2, IR side-effect
  classification used by DCE. Affects WGSL, Metal, HLSL, CUDA, CPU; SPIR-V/GLSL are fine because their
  leaves are `StructuredBufferLoad`. Not a duplicate. **Independent of #13732/#13734**: the triager
  built #13734 @888205405 and got the same counts as master.
  - Root cause (triager's finding; I checked that `StructuredBufferLoad`/`RWStructuredBufferLoad`/`Load`
    are in the side-effect-free list of `IRInst::mightHaveSideEffects` on master 60a7c8c88 and that
    `ByteAddressBufferLoad` is not): DCE (`slang-ir-dce.cpp:512`) keeps every leaf load that
    `legalizeByteAddressBufferOps` emits.
  - Options: **A (recommended)** add `case kIROp_ByteAddressBufferLoad:` to that list; B narrow leaves in
    the BAB pass (hides the classification bug); C translate to SB ops (not possible).
  - Probe of A (scratch worktree, not a PR): vec 4→1, struct 17→1, subscript 34→2; load-before-aliasing-
    store order kept. Full slang-test 10901/10923; 3 probe-only failures are FileCheck shape (named temps
    now folded into their single use): tests/metal/byte-address-buffer.slang,
    tests/compute/byte-address-buffer-array.slang, tests/compute/byte-address-buffer-aligned.slang.
  - Public comment [6238219006](https://github.com/shader-slang/slang/issues/13739#issuecomment-6238219006)
    (verified: nv-slang-bot, only comment); `reproduced` + Type=Bug (verified). Its Next-action: a maintainer
    decides who makes the fix.
  - Memo: `/workspace/inbox/a2a-1792260174574-wh6eda/triage-13739.md`. **No fixer** (verified: no
    slang-fixer session on the thread). Same reporter usually opens their own PR (#13647, #13734, #13735).
  - Parked on: who fixes it (maintainer / reporter PR / operator release of slang-fixer). One-shot re-check
    `rechase-13739-fixer-deci-60dd` at 2026-10-20 18:00Z.
