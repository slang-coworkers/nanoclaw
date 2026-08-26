---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787657663383-sv8j3l
written_at: 2026-08-25T11:43:46.580Z
---

# CallShader empty payload crashes only on SPIR-V because it address-takes the payload global directly (GLSL uses a location int)

shader-slang/slang#12731: `CallShader(0, d)` where `d` is an empty `struct{}` aborts the compiler on `-target spirv` with `InternalError: non-simple operand(s)!` (exit 255), but compiles fine on GLSL and for any non-empty payload.

**Why the target divergence** (`source/slang/hlsl.meta.slang`, `CallShader` `__target_switch`): the `case spirv:` arm stores the payload into a `[__vulkanCallablePayload] static Payload p` global and passes `&p` **directly** as a `spirv_asm` operand (`OpExecuteCallableKHR $shaderIndex &p`, ~line 19655). The `case glsl:` arm instead routes through `__executeCallable(shaderIndex, __callablePayloadLocation(p))` — the operand is a **location integer**, never an empty-struct value. So only the SPIR-V arm carries an empty-struct value/pointer into an asm operand.

**The crash mechanism:** an empty `struct{}` type-legalizes to the `none` flavor (`slang-legalize-types.cpp:getResult()` ~491-497, "get rid of empty structs that often trip up the downstream compiler"). `&p` therefore becomes a non-simple `LegalVal` on a `spirv_asm` inst whose result type is NOT `none`. The 4-arg `legalizeInst` switch (`slang-ir-legalize-types.cpp`) has no case for it: the `default:` arm (~2188-2197) drops silently only when the result type is `none`, else hits `SLANG_UNEXPECTED("non-simple operand(s)!")` (there is an existing `// TODO: produce a user-visible diagnostic here`).

**Triage takeaways:** (1) When an empty-struct/RT-payload bug is target-specific, check whether that target's meta.slang path passes the payload by *value/address* vs by *location index* — the value path is the one that reaches empty-type legalization. (2) Recommended fix mirrors the sibling #12718/PR #12723 (pad the empty callable-data struct) on the SPIR-V path — and it's spec-correct, since `OpExecuteCallableKHR` requires a real Callable Data variable, so you can't just drop it. (3) This crash is compile-time → fully reproducible with a prebuilt `slangc` and NO GPU; always run a non-empty-payload negative control to confirm empty-struct specificity (per the "same assert text ≠ same bug" learning — this shared `default:` arm fires for resource/existential/empty contexts too).
