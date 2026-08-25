---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787600981711-7y6iyb
written_at: 2026-08-24T19:59:33.078Z
---

# Array of ConstantBuffer with resource element crashes type-legalization (issue 9011)

**Symptom:** `ConstantBuffer<Foo> arr[N]` where `Foo` contains a resource (Texture2D/SamplerState/Sampler2D) crashes in IR type-legalization. On `-target spirv`: assert `slang-legalize-types.h(87): flavor == Flavor::simple` in `LegalType::getSimple`, reached from `legalizeGetElement` (slang-ir-legalize-types.cpp). Manifests differently per target but ALL fail: HLSL/Metal → clean-ish `unimplemented: array of parameter group`; WGSL → `slang-ir.cpp:5799 structType` assert; GLSL → segfault; SPIRV → the getSimple assert.

**Isolation matrix (Debug slangc, git ba1f1aec / 2026.13.1):**
- Array of CB<Foo>, Foo = ONLY bytes → COMPILES on spirv/hlsl/glsl/metal.
- Array of CB<Foo>, Foo = only special (Texture2D | SamplerState | Sampler2D) → CRASH (all three).
- Array of CB<Foo>, Foo = MIXED bytes+special → CRASH (all three).
- Controls that COMPILE: single non-array `ConstantBuffer<Foo>` with resource; plain `Foo arr[N]` without CB; bare `Sampler2D arr[N]`. So the trigger is specifically **array + ConstantBuffer + resource element**.

**Root cause (code trace):** `Foo` containing a resource legalizes to a non-simple `LegalType` (a `pair` whose special side is `implicitDeref` of a resource tuple). Array-wrapping distributes it (`wrapLegalType`, slang-legalize-types.cpp). `legalizeGetElement` (the GetElement VALUE path) switches on ptr-operand flavor and handles none/simple/pair/tuple but has **no `implicitDeref` case** (unlike `legalizeGetElementPtr`, which does), and calls `type.getSimple()` on the non-simple result type → assert.

**Key nuance for anyone who inherits the "zero-size" conjecture:** the MIXED case (non-zero ordinary bytes + resource) crashes too, so the failure is NOT "array of a zero-size ordinary part not collapsed to none." The common factor is the resource (non-byte layout unit) producing a non-simple result flavor the value-path GetElement legalization can't decompose. Note `legalizeEmptyTypes` (which would collapse zero-size arrays) only runs for Metal, not SPIRV.

**Repro:** `struct Foo{Sampler2D tex;} ConstantBuffer<Foo> a[1]; ... a[0].tex.Sample(uv);` + `slangc -target spirv-asm`.
