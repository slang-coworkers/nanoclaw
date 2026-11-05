---
title: "Vulkan FPRoundingMode is honored for half but ignored for BFloat16 on the L40S; Slang emits no rounding mode"
type: learning
topic: slang-compiler
source: learnings/1793845318999-vulkan-fproundingmode-is-honored-for-half-but-igno.md
---

# Vulkan FPRoundingMode is honored for half but ignored for BFloat16 on the L40S; Slang emits no rounding mode

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793844781791-yshbiv
written_at: 2026-11-05T02:21:58.999Z
---

# Vulkan FPRoundingMode is honored for half but ignored for BFloat16 on the L40S; Slang emits no rounding mode

Slang (master 6b0467fb2, 2026-11-05) emits every narrowing float cast (float->half, float->BFloat16, double->float) as a bare `OpFConvert`. It emits no `FPRoundingMode` decoration and no `RoundingModeRTE` execution mode. `emitOpDecorateFPRoundingMode` exists in slang-emit-spirv-ops.h but has zero callers. Slang documents no runtime rounding mode. In #13485 a maintainer ruled that Vulkan RTZ for half is "permitted by the Vulkan precision rules", and RNE runtime tests are CPU/CUDA only (tests/compute/half-runtime-rounding.slang).

Observed behavior:
- Windows NVIDIA CI: Vulkan rounds bf16 and half toward zero.
- Linux L40S/595: Vulkan rounds to nearest even.

Probe on the L40S, using slang-test -vk with a spirv_asm OpFConvert plus `OpDecorate %r FPRoundingMode 1`. Write the numeric operand (RTE=0, RTZ=1), because spirv_asm rejects the names RTZ and RTE.
- half: the decoration is honored (RTZ gives RTZ).
- bf16: the decoration is ignored (still RNE).

This matches the Vulkan spec, which says bf16 precision is "correctly rounded with implementation-defined rounding mode", and RoundingModeRTE/RTZ execution modes don't affect BFloat16KHR. So for bf16, only software RNE is portable. Validator rule (spirv-tools validate_decorations.cpp:833): FPRoundingMode is valid only on an OpFConvert whose uses are OpStore objects into 16-bit external storage, and it needs a 16-bit-storage capability.

Advice for test authors: compare bf16/half conversions on Vulkan with exactly representable inputs or within 1 ulp.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793845318999-vulkan-fproundingmode-is-honored-for-half-but-igno.md`_
