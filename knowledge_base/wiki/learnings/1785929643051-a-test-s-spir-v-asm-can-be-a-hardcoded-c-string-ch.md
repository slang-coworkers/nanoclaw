---
title: "A test's SPIR-V asm can be a hardcoded C++ string — check the program-collection overload before triaging 'codegen'"
type: learning
topic: slang-compiler
source: learnings/1785929643051-a-test-s-spir-v-asm-can-be-a-hardcoded-c-string-ch.md
---

# A test's SPIR-V asm can be a hardcoded C++ string — check the program-collection overload before triaging "codegen"

## Context
shader-slang/slang#12364: a MEMBER filed "dEQP-VK.descriptor_indexing.storage_image_minNonUniform fails
with VK-GL-CTS 0.0.9 … this is a Slang codegen correctness issue with non-uniform descriptor indexing of
storage images. Next step: fix the underlying Slang SPIR-V codegen." Both of those framing claims were
wrong, and the reporter had already burned CI runs bisecting Slang commits.

## The trap: log evidence that looks like Slang output but isn't
The failing case's qpa log shows a full SPIR-V module with `OpSource GLSL 450`, a **present**
`OpDecorate %n NonUniform`, `OpImageTexelPointer` + `OpAtomicIAdd`. It is extremely tempting to reason
about that module as compiler output (why is the source language GLSL? why didn't the decoration get
dropped like in the known NonUniform bugs?).

**It is a hardcoded C++ string literal.** In VK-GL-CTS,
`vktDescriptorSetsIndexingTests.cpp:2662-2733` builds the whole module with `ostringstream <<` lines —
literally `s << "               OpSource GLSL 450\n";` and `s << "               OpDecorate %41 NonUniform\n";`.
`minNonUniform` cases return early into `initAsmPrograms` (:4410-4415) and register a `SpirVAsmSource`.
⇒ One fact ("the test hand-authors its asm") explains every puzzling detail at once. When several log
oddities all need separate explanations, suspect a single upstream fact instead.

## The generalizable check: CTS dispatch is by C++ OVERLOAD, so it's a compile-time fact
- `GlslSource` / `HlslSource` → `buildProgram` (`vkPrograms.cpp:689` / `:779`) → `compileShaderToSpirV`
  (`vkShaderToSpirV.cpp:266`) → **the only Slang call site**, `:291`, gated by `DISABLE_CTS_SLANG` (:285).
- `SpirVAsmSource` → **`assembleProgram`** (`vkPrograms.cpp:871`), which never calls it.
  Both execution paths confirmed: runtime `vkResourceInterface.cpp:1027`, offline prebuild
  `vktBuildPrograms.cpp:331` (`BuildSpirVAsmTask`, fed from `spirvAsmSources` :489-501).
⇒ Before accepting "CTS test X proves a Slang codegen bug", find which collection X registers into.
An asm-authored case cannot exercise Slang codegen no matter what its name says.
**Red herring to expect:** the Slang integration itself calls `assembleSpirV`
(`vkShaderToSpirV_slang.cpp:1035`) — that's the REVERSE direction (Slang emitted spirv-asm text, CTS
assembles it) and does not put an asm test into Slang's path.

## The empirical closer, and why it's only valid with one extra check
In two nightlies Slang failed to load **11,545** times (`failed to load slang.dll`) and 11,545 tests
failed — yet this test logged `Pass (Pass)`. That is load-bearing ONLY because there is **no silent
glslang fallback**: when the Slang path fails, `buildProgram` does
`TCU_THROW(InternalError, "Compiling GLSL to SPIR-V failed")` (`vkPrograms.cpp:754`), and :291 returns
Slang's result directly. Had a fallback existed, "it passed without Slang" would have proven nothing.
⇒ "It passed while X was unavailable" needs the no-fallback check before it means "it doesn't use X".
Phrase it as *X was unavailable yet the case completed*, never *X was entirely absent* — a failed DLL
load elsewhere doesn't prove no X code/state existed in the process.

## Grep false positive that cost me a wrong reading
`grep -c "SLANG: "` on a CI log matched the workflow's own `DISABLE_CTS_SLANG: 0` env echo, not Slang's
logger (`#define SLANG_LOG std::cout << "SLANG: "`). I first read "21 Slang lines" from noise. Anchored
`grep -cE "Z SLANG: "` (after the timestamp) gives **3** in the full-suite run vs **0** in the
single-case runs — and that asymmetry became real evidence. A substring living inside an unrelated
identifier is a false-positive generator; anchor it.

## Blob hashes beat a file list for "did this change?"
The issue claimed "the test was updated upstream between the two releases". `compare A...B` showed 4
files and no test code, but the decisive artifact was the **blob SHA of the test file being identical at
both tags** with a **must-differ control** (the integration file's blob differs) — plus
`external/fetch_sources.py` identical, so declared SPIRV-Tools/glslang pins match too.
⚠️ Scope it honestly: that proves the *checked-in source and declared pins* are unchanged. It does NOT
prove "the shipped test didn't change" — the two prebuilt binaries were built 18 months apart, so a
toolchain/artifact difference stays a live candidate. Source-identity ≠ binary-identity.

## A pretty bit pattern needs its pre-images counted
`max difference = 1.34744e+08` is exactly `0x08080808` (134744072) — I nearly published "exactly". The
log prints **6 significant digits**; I then measured that **1001** integers render as `1.34744e+08`. So
it's *consistent with* a byte-replicated pattern, one pre-image among a thousand. A round number
matching a tidy hex pattern is a coincidence candidate until you count how many values display the same.

## Also worth stealing
- **5 sibling cases passing is a sharper instrument than 1 failing.** All six `*_minNonUniform` cases
  share the asm generator and the NonUniform/RuntimeDescriptorArray machinery; only `storage_image`
  (the sole `OpImageTexelPointer`+`OpAtomicIAdd` arm) fails ⇒ narrows to the atomic-on-storage-image
  texel pointer, not non-uniform indexing generally.
- **A `-Tail 1000` qpa dump is not suite-wide evidence.** "7/7 blocks show SpirVAssemblySource, zero
  GLSLSource" was true of the last ~5 cases only. Two of those were ray_query cases whose module is 36
  `glslSources.add` vs 1 asm — checking them is what proved the tag doesn't imply "bypassed Slang".
  Also `GLSLSource` is not a qpa tag at all; the real ones are `VertexShader`/`ComputeShader`/… wrapping
  `ShaderSource` (`qpTestLog.c:225-241`).
- **Exclusion is not attribution.** I proved direct Slang codegen is excluded; I did NOT identify the
  culprit. Publishing "belongs to the CTS fork / driver, not Slang" would have assigned cause to a
  component I never measured. State the candidate set and say it's unresolved.
- **A drafted mutation is not a performed one.** My draft status bullet said "Applied `reproduced` … set
  Type=`Bug`" while I had applied neither — caught by reading live issue state before posting. A bullet
  describing your own mutations is exactly where that gap hides.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785929643051-a-test-s-spir-v-asm-can-be-a-hardcoded-c-string-ch.md`_
