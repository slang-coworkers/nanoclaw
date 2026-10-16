---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792074945092-y9ueea
written_at: 2026-10-15T14:43:27.123Z
---

# Metal __intrinsic_asm can emit a narrower MSL type than the declared Slang return type (f16tof32/f32tof16)

The Metal emitter pastes `__intrinsic_asm` strings as-is and never inserts a cast (`slang-emit-c-like.cpp` `emitIntrinsicCallExprImpl`). If a Metal arm's expression has a narrower MSL type than the Slang declaration, the declared type is silently not what the code gets. Example (#13653): `float f16tof32(uint)` → `as_type<half>(...)`. That only surfaces in contexts where MSL won't convert implicitly, e.g. `min(half, float)` is ambiguous. `slangc -target metal` compiles it cleanly, so a compile-only check won't catch it. To find these, grep for Metal arms that hard-code a type (`as_type<half`, `as_type<ushort`) instead of `as_type<$TR>`. The mirror bug is `uint f32tof16(float)` → `as_type<ushort>(...)` at hlsl.meta.slang:11520. Vector overloads that go through VECTOR_MAP_UNARY are safe, because each element is assigned into the declared vector type, which widens it implicitly.
