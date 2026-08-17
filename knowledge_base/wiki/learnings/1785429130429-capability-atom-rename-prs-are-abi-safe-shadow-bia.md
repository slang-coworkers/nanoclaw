---
title: "Capability-atom rename PRs are ABI-safe + shadow bias/grad uses Bias/Grad not Lod (slang#12244 MERGED)"
type: learning
topic: slang-compiler
source: learnings/1785429130429-capability-atom-rename-prs-are-abi-safe-shadow-bia.md
---

# Capability-atom rename PRs are ABI-safe + shadow bias/grad uses Bias/Grad not Lod (slang#12244 MERGED)

shader-slang/slang#12244 SHIPPED (PR #12248 MERGED 2026-07-30, commit be27d078, by jkwak-work): scope-A capability-atom naming cleanup for shadow-comparison texture sampling. Two durable, reusable findings:

**1. Adding/reordering capability atoms in slang-capabilities.capdef is NOT an ABI/backward-compat break.** Verified at file:line (HEAD 7c58a326b): the public `SlangCapabilityID` (include/slang.h:835) is opaque, single-enumerator (SLANG_CAPABILITY_UNKNOWN=0), and resolved by NAME at runtime via `ISession::findCapability(char const* name)` (slang.h:4189) — the header comment explicitly states "Capability IDs are NOT guaranteed stable across versions; look up by name." The generated `CapabilityName`/`CapabilityAtom` enums live ONLY in build/.../slang-generated-capability-defs.h (internal, never in include/), are POSITIONAL (generator uses a sequential counter, no stable-name table like IR ops have), and are exposed by NO public API. `findCapability` uses a name hash (slang-global-session.cpp:927 → lookupCapabilityName). So inserting atoms mid-list shifts only internal enum ints. PRECISION NUANCE to carry honestly: atoms ARE serialized by value into internal IR / .slang-module (IRRequireCapabilityAtomDecoration reads intVal, slang-ir-insts.h:250) — but that format is already not cross-version-stable (recompiled per compiler version), so every prior capdef addition shifted these and none were breaking. Net: `pr: non-breaking` is correct for capdef atom add/reorder. Don't over-claim "never serialized by value"; DO claim "no public ABI break + consistent with established module-versioning practice."

**2. Naming provenance — HLSL SampleCmp* → GLSL/SPIR-V surface (verified against hlsl.meta.slang/glsl.meta.slang emit):**
- `SampleCmp`/`SampleCmpLevelZero`: SPIR-V `OpImageSampleDrefImplicitLod` (no lod/bias operand); GLSL `texture`. First HLSL SM 4.0 (arrays 4.1).
- `SampleCmpLevel`: SPIR-V `OpImageSampleDrefExplicitLod` + **Lod** operand; GLSL `textureLod`/`textureLodOffset`. First HLSL SM 6.7.
- `SampleCmpBias`: SPIR-V `OpImageSampleDrefImplicitLod` + **Bias** operand (NOT Lod — `…ImplicitLod` is the OPCODE-FAMILY name, not a Lod operand; Bias and Lod are distinct mutually-exclusive SPIR-V image operands). NO `case glsl:` — the HLSL SampleCmpBias METHOD is hlsl_spirv-only. First HLSL SM 6.8.
- `SampleCmpGrad`: SPIR-V `OpImageSampleDrefExplicitLod` + **Grad** operand; hlsl_spirv-only method too. SM 6.8.
- SEPARATE surface: GLSL's OWN native shadow builtins (glsl.meta.slang) DO have bias `texture(samplerXShadow, p, bias)` (:1972+) and grad `textureGrad(samplerXShadow,...)` (:3598+) forms — carry texture_shadowlod, distinct from the HLSL methods. (Don't conflate: a subagent WRONGLY claimed "GLSL textureGrad is non-shadow only" — FALSE.)
- `GL_EXT_texture_shadow_lod` is the only GLSL extension in play, needed ONLY for LOD-form shadow sampling on sampler2DArrayShadow/CubeShadow/CubeArrayShadow (the #11156 baseline-vs-ext split); baseline 1D/1DArray/2DShadow don't need it. SPIR-V needs NO extension for any comparison-sample op (core Dref ops).
- ⇒ `texture_shadowbias` is the terminologically-correct atom name (matches the `Bias` operand / trailing-bias `texture(...)`); a `…lod`-named atom for bias would misdescribe it. Maintainer (jkwak-work) accepted this.

METHOD LESSON: when a maintainer asks a load-bearing provenance/ABI question during PR review, verify against source file:line + specs before answering — DeepWiki got the SM version (claimed SM5.1 for SampleCmp; MS docs say SM4.0) and the GLSL-support question partly wrong. Primary source (the actual .meta.slang emit + MS HLSL reference + include/slang.h) wins over the LLM wiki.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785429130429-capability-atom-rename-prs-are-abi-safe-shadow-bia.md`_
