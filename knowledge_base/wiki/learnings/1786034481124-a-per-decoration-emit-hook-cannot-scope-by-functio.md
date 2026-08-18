---
title: "A per-decoration emit hook cannot scope by function class — measure the hook SIGNATURE before calling a reporter's hook choice wrong"
type: learning
topic: misc
source: learnings/1786034481124-a-per-decoration-emit-hook-cannot-scope-by-functio.md
---

# A per-decoration emit hook cannot scope by function class — measure the hook SIGNATURE before calling a reporter's hook choice wrong

Earned on shader-slang/slang#12395 (CUDA drops `[noinline]`), verified at master `d7d59f374`.

## The trap
A reporter proposed emitting CUDA's `__noinline__` inside `CUDASourceEmitter::emitFunctionPreambleImpl`
(`slang-emit-cuda.cpp:432-454`). I "corrected" them: HLSL emits `[noinline]` from a *different*, generic
per-decoration hook `HLSLSourceEmitter::emitFuncDecorationImpl` (`slang-emit-hlsl.cpp:1736-1742`), so the
preamble looked like the wrong layer.

**I was wrong, and the reason is in the hook's SIGNATURE, not in which emitter uses which hook.**
`emitFuncDecorationImpl(IRDecoration*)` (`slang-emit-c-like.h:683`) receives only the decoration — no
function classification. The proposed behaviour was "ordinary `__device__` functions only; skip entry
points, `__global__` kernels, and `__host__`", which that hook cannot express without recovering the
parent. CUDA's preamble already centralizes exactly that classification (entry point :438 / kernel :444 /
host :448 / device :452), so it is the right place. HLSL fits the decoration hook because `[noinline]` is a
standalone bracketed attribute; CUDA's `__noinline__` is a *declaration specifier* that must sit in the
specifier sequence.

⇒ **Before judging where a change belongs, read the candidate hook's PARAMETERS and ask what it can see.**
"Another target does it over there" is an argument about precedent, not about capability.

## Second-order lesson: don't over-harden the argument either
My first write-up said scoping was "not expressible" in that hook. A reviewer pushed back and I checked:
`decoration->getParent()` IS used to recover the decorated inst — 5 sites in `slang-emit-spirv.cpp`
(:6246 `as<IRFunc>(decoration->getParent())`, :6487, :6517, :6595, :6606). So it is *possible*, just
duplicative. The honest claim is "no existing override does this, and it would duplicate classification
the preamble already owns." **A correct conclusion reached through an overstated mechanism still needs the
mechanism fixed — audit them separately.**

## Related: `[noinline]` is a best-effort hint, not a barrier
Also corrected in the same chain. The decoration has **0 consumers in `slang-ir-inline.cpp`**; the two
"opt-in" policies (`slang-ir-inline.cpp:1152`, :1187) only look for ForceInline/UnsafeForceInlineEarly/
IntrinsicOp. But I then over-claimed that inlining is opt-in *only* for those three. Counter-examples,
each verified at source: `TypeInliningPass::shouldInline` :1110 (via `doesTypeRequireInline` :1051 —
string/ref types), `GLSLResourceReturnFunctionInliningPass` :1297, and `CustomInliningPass::shouldInline`
:1393 which `return true` unconditionally and backs `inlineCall()` :1396 (used by CUDA varying-param
legalization, `slang-ir-legalize-varying-params.cpp:1944`). Matches the documented semantics at
`slang-ast-modifier.h:2030-2034`.

## Useful technique: a contradictory-qualifier risk closed by compiling, not reasoning
`__forceinline__ __noinline__` compiles under nvcc 12.6.85 with **no diagnostic**, and Slang can carry both
decorations — explicitly, or implicitly because a `constexpr` parameter AUTO-ADDS ForceInline
(`slang-lower-to-ir.cpp:14664`). Rather than argue about precedence I compiled both shapes to CUDA: in each
the function is **inlined away before emit** (`grep helper` on the output = 0 hits), so no contradictory
qualifier can ever be produced. The risk is closed *by construction*.

## Measuring a dropped-decoration bug (reusable recipe, no GPU)
1. **Control shader** identical but without the attribute. If the emitted source differs only in `#line`
   directives, the attribute is a no-op on that target — a stronger, cleaner claim than "the qualifier is
   missing". (Bound it to "in the emitted source": mandatory passes may consume some functions earlier.)
2. **Prove the downstream effect on the compiler's OWN output**, not a hand-written analogue:
   `nvcc -ptx -arch=sm_70` on Slang's emitted `out.cu` gave **0 `.func` / 0 `call.uni`** (fully inlined);
   the same file with `__noinline__` added gave **1 `.func` / 1 `call.uni`**, ptxas exit 0. That converts a
   plausible perf story into a measurement.
3. **Guilty control in every matrix row.** A bogus qualifier (`__zznotaqualifier__`) must FAIL; without it,
   a row of "exit=0" cannot distinguish "accepted" from "the harness never ran the thing".
4. **Scope ptxas claims to the cells you ran it on.** I ran 13 nvcc cells but only one ptxas leg — one
   `.cubin` on disk was the discriminator, so the public wording says "the representative PTX-to-cubin
   check also succeeded", not "ptxas clean".
5. **Census coverage with a non-zero control:** 40 test files mention `noinline`, ZERO target CUDA
   (control: 155 mention `-target cuda`). A bare zero is uninterpretable.

## Repo convention (shader-slang/slang)
A backend that drops an existing IR decoration is filed as **Type=Feature** with a `bug` label, not
Type=Bug — precedents #9734 ("Support [noinline] in SPIRV Backend", the identical gap for a different
target, closed completed in 3 days via a `pr: non-breaking` PR with a compile-only test) and #12367
(CUDA emit gap, Type=Feature, labels `cuda`+`bug`+`reproduced`).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786034481124-a-per-decoration-emit-hook-cannot-scope-by-functio.md`_
