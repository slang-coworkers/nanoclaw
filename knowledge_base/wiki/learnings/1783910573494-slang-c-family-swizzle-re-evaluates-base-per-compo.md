---
title: "slang C-family swizzle re-evaluates base per component (CUDA/CPP perf bug)"
type: learning
topic: slang-compiler
source: learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md
---

# slang C-family swizzle re-evaluates base per component (CUDA/CPP perf bug)

**#12073, CUDA/CPP target-emit.** On CUDA + CPU/C++ (shared C-family emitter), a multi-component swizzle read (`.rgb`/`.xyz`, elementCount>1) is emitted as a brace initializer `float3{base.x, base.y, base.z}` — and `CPPSourceEmitter`'s `kIROp_Swizzle` handler (`slang-emit-cpp.cpp:1642-1720`) calls `emitOperand(getBase())` **inside** the per-component loop (1692-1716). So the base is re-emitted once per component. When the base is a value that `shouldFoldInstIntoUseSites` folds (a texture fetch / buffer load — single IR use, no side-effect flagged), it gets **textually duplicated N×** → ~N× memory traffic. SPIR-V (`OpVectorShuffle`) and HLSL (native `.xyz`, emitted by the base `CLikeSourceEmitter` path at `slang-emit-c-like.cpp:2870-2892`) evaluate the base ONCE, so those targets are unaffected. Output values are correct — this is a codegen-quality/perf bug, not a wrong-result bug.

**Why the fold gate misses it:** `shouldFoldInstIntoUseSites` (`slang-emit-c-like.cpp:1685-1687`) only refuses to fold on >1 *IR* uses. A multi-element swizzle is a SINGLE IR use that expands to N *textual* references — invisible to the multi-use guard.

**The principled fix seam:** `CPPSourceEmitter::shouldFoldInstIntoUseSites` (override at `slang-emit-cpp.cpp:1931-1970`) ALREADY refuses to fold a vector/matrix value when its user is a reshape/cast (`1943-1951`), with the stated rationale "the implementation of cast will have multiple references to it." A multi-element swizzle base is the identical situation — extend that guard to `kIROp_Swizzle` with `getElementCount()>1` so the base materializes as a temp via existing machinery. Target-scoped, minimal, no adjacent regression.

**Grep pitfall verifying this:** the whole `float3{...}` initializer is on ONE line, so `grep -c tex2Dfetch` (counts matching *lines*) reports 1 even when the fetch appears 3×. Use `grep -o tex2Dfetch | wc -l` to count occurrences. GPU-free repro: `slangc repro.slang -target cuda -entry f3_loop -stage compute -o k.cu` then count occurrences. Reproduced at HEAD 8f0c3515d: 1/3/1 for f4_all/f3_loop/f3_epi. Cross-ref slangpy#1059 (~2.87× CUDA slowdown).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md`_
