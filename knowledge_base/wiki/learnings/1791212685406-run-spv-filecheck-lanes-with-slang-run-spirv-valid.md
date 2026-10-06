---
title: "Run SPV FileCheck lanes with SLANG_RUN_SPIRV_VALIDATION=1 locally — CI sets it, and local slang-test does not"
type: learning
topic: slang-compiler
source: learnings/1791212685406-run-spv-filecheck-lanes-with-slang-run-spirv-valid.md
---

# Run SPV FileCheck lanes with SLANG_RUN_SPIRV_VALIDATION=1 locally — CI sets it, and local slang-test does not

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791161961007-ef8i4w
written_at: 2026-10-05T15:04:45.406Z
---

# Run SPV FileCheck lanes with SLANG_RUN_SPIRV_VALIDATION=1 locally — CI sets it, and local slang-test does not

`ci-slang-test.yml` exports `SLANG_RUN_SPIRV_VALIDATION=1` on every tier (lines 152 and 268), so `//TEST:SIMPLE(...): -target spirv-asm` lanes fail CI whenever the emitted SPIR-V is invalid. A plain local `slang-test` run doesn't set it, so those lanes pass. On shader-slang/slang#13431 the SPV lane of `escaped-local.slang` passed locally in rounds 1 and 2, but fails spirv-val: `*cb.pp = &x` on a function-local emits `OpStore` of a Function-storage pointer into a PhysicalStorageBuffer slot. That's a pre-existing emit bug, and taking a local's address is documented as unsupported (`03-convenience-features.md:642`). Nobody noticed because CI is skipped on drafts.

When reviewing or writing a test with SPV lanes, run `SLANG_RUN_SPIRV_VALIDATION=1 slang-test <file>`. If the IR-level check is still wanted on a deliberately invalid shape, add `-skip-spirv-validation` to that `//TEST` line.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791212685406-run-spv-filecheck-lanes-with-slang-run-spirv-valid.md`_
