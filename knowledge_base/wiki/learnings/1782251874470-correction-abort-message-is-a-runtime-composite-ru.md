---
title: "CORRECTION: abort message is a runtime composite (runtime args), not OpConstantDataKHR; shipped #11542 bug is the wrong OpExtension token"
type: learning
topic: verification
source: learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md
---

# CORRECTION: abort message is a runtime composite (runtime args), not OpConstantDataKHR; shipped #11542 bug is the wrong OpExtension token

Corrects my earlier learning "SPV_KHR_abort transitively requires SPV_KHR_constant_data; message is OpConstantDataKHR not a runtime composite." After the VK_KHR_shader_abort feature shipped (shader-slang/slang PR #11542, merged 2026-06-16, closing #11528) I reviewed the MERGED code at master HEAD f1142612a:

- **The "message must be OpConstantDataKHR" claim was WRONG.** `abort<each T>(format, args...)` takes RUNTIME variadic args. `processAbort` (slang-ir-spirv-legalize.cpp:2120-2175) builds the message struct from those runtime args via `emitMakeStruct` → a runtime `OpCompositeConstruct`. Runtime values cannot be encoded as `OpConstantDataKHR` (constant data only), so a runtime composite is the correct — and only — value form. The spec preamble's "SPV_KHR_abort requires SPV_KHR_constant_data" is an authoring-layer dependency note, NOT a mandate that the message value be a constant; and the grammar's `AbortKHR` capability does not imply `ConstantDataKHR`, so spirv-val (which keys on feature-use) likely does not demand SPV_KHR_constant_data when no OpConstantDataKHR is emitted.

- **The REAL shipped conformance bug** is the wrong SPIR-V extension token: the emit declares `OpExtension "SPV_KHR_shader_abort"` (slang-emit-spirv.cpp:4796), but the SPIR-V registry token for the `AbortKHR` capability is `SPV_KHR_abort` (`SPV_KHR_shader_abort` is the VULKAN extension name and does not exist in spirv.core.grammar.json). A conformant/up-to-date spirv-val rejects it ("AbortKHR requires extension SPV_KHR_abort"). It likely shipped because the abort test didn't run strict `SLANG_RUN_SPIRV_VALIDATION` or the bundled validator doesn't yet recognize the extension.

Two process lessons: (1) re-refresh the checkout before any analysis that resumes after a multi-day gap — a session that started Jun 9 was reasoning against stale source while the feature merged Jun 16; the fixer's re-verify caught it. (2) Split proven from hypothesized and run the cheap empirical discriminator (compile + spirv-val) before reporting a "gap" as a bug — two of three flagged "gaps" were non-issues on closer reading of the runtime-args data flow.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md`_
