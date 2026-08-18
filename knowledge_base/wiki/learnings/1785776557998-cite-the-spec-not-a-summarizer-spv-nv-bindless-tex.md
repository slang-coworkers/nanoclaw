---
title: "Cite the SPEC, not a summarizer: SPV_NV_bindless_texture accepts uint2 OR uint64 (I got this wrong and it cost 4 guard iterations)"
type: learning
topic: ci-tooling
source: learnings/1785776557998-cite-the-spec-not-a-summarizer-spv-nv-bindless-tex.md
---

# Cite the SPEC, not a summarizer: SPV_NV_bindless_texture accepts uint2 OR uint64 (I got this wrong and it cost 4 guard iterations)

Two hard lessons from slang#12186's cross-width DescriptorHandle work.

## 1. I asserted a SPIR-V rule from a DeepWiki summary and it was WRONG
I claimed `OpConvertUToImageNV`/`OpConvertUToSamplerNV`/`OpConvertUToSampledImageNV` require a 64-bit SCALAR operand, and therefore that a `%v2uint` operand was invalid SPIR-V and a repo test (`tests/bugs/gh-9916.slang`) was relying on a latent miscompile. I posted that publicly on a maintainer's PR.

The actual spec text (SPV_NV_bindless_texture):
> If OpSamplerImageAddressingModeNV has a literal value of 64, Operand should be specified either as 64-bit unsigned integer type **or vector of 2 unsigned 32-bit integer type**.

Slang always emits `OpSamplerImageAddressingModeNV 64`, so uint2 is explicitly legal. The test was fine; my diagnostic was rejecting valid code. Caught only because codex challenged it and I then fetched the raw `.asciidoc` from SPIRV-Registry.

**Rule:** for any "is this valid SPIR-V/GLSL/HLSL?" claim that gates a diagnostic or a test change, read the primary spec text. DeepWiki even *caveated* its own answer ("headers do not explicitly state… however, typically") and I used it anyway. A caveated inference is not a citation. Fetch `raw.githubusercontent.com/KhronosGroup/SPIRV-Registry/main/extensions/<VENDOR>/<EXT>.asciidoc`.

**Corollary — spirv-val silence proves nothing.** Master's `%v2uint` operand passed spirv-val, and I first read that as "validator gap confirming my theory." It was actually the validator being *correct*. Separately confirmed there is NO operand-type rule for these ops in `external/spirv-tools/source/val/` — so validation neither confirms nor denies. Don't infer a spec rule from validator behavior in either direction.

## 2. Four consumer-side guards = the root cause is upstream
I wrote 4 variants of an emit-time guard (SLANG_UNIMPLEMENTED → representation-mismatch diagnostic → operand-type diagnostic → operand-type + wrap-chain walk). Each caught a different subset, and #4 needed to walk the operand graph to recover the initializer's width — which slang's own CLAUDE.md lists as a red flag ("context rediscovery by graph walking … usually downstream repair").

The real root: in `hlsl.meta.slang` the handle read-back conversions (`extension uint2 { __init<T>(DescriptorHandle<T>) }` and the `uint64_t` one) are **capability-gated but not kind-gated**, so once the representation became kind-dependent, "build at width A, read at width B" became expressible. That single upstream hole surfaced in ≥3 consumers: module-scope constant (invalid `OpIAdd %ulong` with `%v2uint` → spirv-val error), function-scope cast (runtime path compares representation-vs-named width, sees a match, forwards wrong width), and inside the descriptor-heap lowering (`((uint2)h).x` on a uint64 → `OpCompositeExtract %uint %ulong_… 0`, an extract on a scalar → spirv-opt `const_folding_rules.cpp:129: cc != nullptr` ASSERT).

**Heuristic:** when the 2nd guard for one logical defect misses a case, stop patching consumers and go find the producer. Concretely: if the same wrongness appears at module scope AND function scope AND inside a lowering pass, it is one upstream hole, not three bugs. Escalate the producer fix (esp. when it's public `.meta.slang` surface needing maintainer approval) instead of self-directing a 5th consumer guard.

**Diagnostic-vs-assert test that DID work:** ask "can plausible user code reach this shape?" and *test it*, don't reason. Both `DescriptorHandle` integer constructors are public + capability-permitted for every kind, so a fallback-texture-handle-packed-as-uint2 shader reaches it → an assert would violate the issue's own "must not abort with an internal error" acceptance text. Reachable ⇒ diagnostic; unreachable ⇒ assert + justify why unreachable in the PR.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785776557998-cite-the-spec-not-a-summarizer-spv-nv-bindless-tex.md`_
