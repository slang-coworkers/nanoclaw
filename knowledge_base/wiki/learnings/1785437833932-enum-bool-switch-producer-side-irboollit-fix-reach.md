---
title: "enum:bool switch — producer-side IRBoolLit fix reaches HLSL/Metal for free; case true: is legal; int8_t is NOT native HLSL"
type: learning
topic: slang-compiler
source: learnings/1785437833932-enum-bool-switch-producer-side-irboollit-fix-reach.md
---

# enum:bool switch — producer-side IRBoolLit fix reaches HLSL/Metal for free; case true: is legal; int8_t is NOT native HLSL

Investigating slang#12298 (canonicalize `enum : bool` switch case labels; C-family emit `case int8_t(1):` instead of `case true:`). Follow-up to #12260/PR #12275. Three findings the triage memo did NOT have, verified at HEAD 111f1ff715:

**1. HLSL & Metal emitters delegate IntLit/BoolLit to the C-like base — so a producer-side fix needs ZERO emitter edits.**
`HLSLSourceEmitter::emitSimpleValueImpl` (slang-emit-hlsl.cpp:1760-1803) and `MetalSourceEmitter::emitSimpleValueImpl` (slang-emit-metal.cpp:1151-1212) both intercept **only `kIROp_FloatLit`** and fall through to `Super::emitSimpleValueImpl` for everything else. So once `lowerEnumType` canonicalizes the label to `IRBoolLit`, the shared base `kIROp_BoolLit` arm (slang-emit-c-like.cpp:1433) emits `true`/`false` for HLSL, Metal, CUDA, and C++ all at once. This is a strong point for the producer-side (Approach A) fix over an emitter-side band-aid.

**2. `case true:`/`case false:` on a `bool` selector is accepted + runtime-correct — verified empirically.** g++/clang++ host: compiles, selects correctly. nvcc 12.6 `-arch=sm_89`: compiles AND executed on a real NVIDIA L40S GPU → returns correct branch values `{10,20}`. So the selector does NOT need normalizing to int (heavy Approach C-lite is unnecessary). Caveat: both the current `int8_t(N)` form AND `true/false` form emit an identical host `-Wswitch-bool` warning, so A is no worse; nvcc device path warns for neither.

**3. `int8_t` is NOT a native HLSL scalar keyword → today's `case int8_t(0):` HLSL is likely a REAL DXC bug, not just a smell.** HLSL 8-bit support is `-enable-16bit-types`/SM6.2 (exposes 16-bit types), there's no `int8_t` keyword; in hlsl.meta.slang `int8_t` is only a Slang-side name/intrinsic mapping. slangc "exit 0" only means slangc EMITTED HLSL text — it never ran DXC. So the HLSL target is arguably a latent correctness bug, upgrading urgency. NEEDS DXC confirmation (DXC/Metal both absent on our Linux box; HLSL/MSL acceptance is argued by Clang-derivation proxy, flag for Windows-DXC + macOS CI).

**Also:** DeepWiki was subtly WRONG here — it claimed getIntValue canonicalizes bool→IRBoolLit, but at case-label lowering time `lowerType` returns the still-opaque IREnumType (enum lowering runs later), so that path never fires; the IRIntLit-of-enum survives, and lowerEnumType (:157-159) swaps only the type operand, not the opcode. Trust source+repro over DeepWiki for lowering-order questions.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785437833932-enum-bool-switch-producer-side-irboollit-fix-reach.md`_
