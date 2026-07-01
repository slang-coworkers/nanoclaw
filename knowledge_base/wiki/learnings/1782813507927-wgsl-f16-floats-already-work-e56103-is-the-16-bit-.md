---
title: "WGSL f16 floats already work; E56103 is the 16-bit-INTEGER path (slang #11835)"
type: learning
topic: slang-compiler
source: learnings/1782813507927-wgsl-f16-floats-already-work-e56103-is-the-16-bit-.md
---

# WGSL f16 floats already work; E56103 is the 16-bit-INTEGER path (slang #11835)

**Finding (verified at HEAD c3037d220, slang #11835):** The WGSL/WebGPU backend ALREADY fully supports 16-bit floats (`half`/`f16`). A report that "WGSL is missing 16-bit float support" is most likely the `bit_cast<uint16_t>`/16-bit-INTEGER path, not f16.

**Why the confusion:** The diagnostic `error[E56103]: 16-bit integers not supported in WGSL` (`int16-not-supported-in-wgsl`) is **integer-only** and fires on `Int16Type`/`UInt16Type`. WGSL has NO 16-bit integer types at all (no i16/u16 in the spec) — a hard WGSL language limitation, not a Slang gap. A repro like `uint32_t(bit_cast<uint16_t>(h))` trips E56103 on the `uint16_t`, even though the `half` is fine.

**Empirical discriminator (run before trusting the title):** drop the 16-bit int and recompile.
- `RWStructuredBuffer<half>; out[0] = h*2.0h;` → compiles, emits `enable f16;` + `var<storage,read_write> ... : array<f16>` + runtime f16 store. Proves f16 works (not just const-folding).

**Code map (HEAD c3037d220):**
- `kIROp_HalfType` → emits `f16`, sets `m_f16ExtensionEnabled`: `source/slang/slang-emit-wgsl.cpp:527-530`
- half float literal → `<value>h`: `slang-emit-wgsl.cpp:1151-1157`
- `enable f16;` written in `emitFrontMatterImpl` when flag set: `slang-emit-wgsl.cpp:1777-1788`
- E56103 raised (integer-only) + early return: `slang-emit-wgsl.cpp:543-548`; def `source/slang/slang-diagnostics.lua:5487-5491`
- `half` unrestricted by capability/target (no wgsl_f16 atom); SPIR-V precedent `SpvCapabilityFloat16` slang-emit-spirv.cpp:2349-2350.

**Takeaway:** For "target X missing type Y" reports, isolate Y from any sibling cast/operation in the repro before concluding the type is unsupported — the failing element may be an adjacent unrepresentable type (here uint16), not the headline type.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782813507927-wgsl-f16-floats-already-work-e56103-is-the-16-bit-.md`_
