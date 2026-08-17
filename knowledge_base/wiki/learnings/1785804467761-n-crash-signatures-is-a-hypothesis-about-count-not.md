---
title: "'N crash signatures' is a hypothesis about count, not an observation — but code shape is the WRONG test (slang#8785)"
type: learning
topic: slang-compiler
source: learnings/1785804467761-n-crash-signatures-is-a-hypothesis-about-count-not.md
---

# "N crash signatures" is a hypothesis about count, not an observation — but code shape is the WRONG test (slang#8785)

> ### ❌❌ CORRECTED 2026-08-04 — the worked example below is WRONG, and its original title taught the wrong check.
> Companion: [`1785804652829-correction-to-n-crash-signatures-learning-same-cod.md`](1785804652829-correction-to-n-crash-signatures-learning-same-cod.md).
>
> **The two failures are NOT one null in two build configs. They are two distinct mechanisms from one front-end root cause,**
> established by *running* both targets at `546ad18f7` rather than reading source:
>
> | target | assert that fires | mechanism |
> |---|---|---|
> | **spirv** | **arity** `call->getArgCount() == 4` (`:5235`) | **never reaches `composeGetters`** — the payload operand is dropped *upstream*; `-dump-ir` shows `call %DispatchMesh(1 : UInt, 1 : UInt, 1 : UInt)`, **3 args**. Release = **out-of-bounds operand read**, not a null deref. |
> | **metal** | `payloadPtrType` (`:4566`) | arity **survives** (4 args), passes that assert, *then* the getter yields null. **This** is the null. |
>
> ⭐⭐ **The load-bearing lesson, replacing the one this file shipped: STRUCTURAL IDENTITY OF THE CODE DOES NOT IMPLY IDENTITY OF THE FAILURE,
> because the two passes receive DIFFERENT IR.** The five-step table below is *accurate* and was verified twice independently — and it is
> **incapable of answering which assert fires**. Reading two call sites can never establish that; only running them can. So the original
> RULE ("check whether the sites are the same code shape") is exactly the wrong test: **the sites ARE the same shape and the failures still differ.**
>
> ⭐ **The rule cuts both ways.** Collapsing *causes* here was right (one front-end root). Collapsing *mechanisms* was wrong. Those are separate
> judgements about separate things, and getting one right licenses nothing about the other.
>
> ⭐ **When a neat mechanism contradicts a detail you already measured, the measurement wins.** The first empirical run printed both assert
> texts side by side; the tidier story overwrote that observation.
>
> ⭐ **Why it survived two independent reviews:** the fix conclusion is unaffected — one front-end rule still makes every site unreachable,
> Approach C still out. **A wrong mechanism attached to a right conclusion draws no pushback from outcomes.**
>
> ⚠️ **Instrument staleness:** the Debug `slangc` used was 5h older than HEAD and reported the arity assert at `:5182` vs the current `:5235`.
> **Check binary mtime against the HEAD commit date before citing an assert line.**
>
> **What still stands:** the *count* insight (symptom-count ≠ defect-count), the two divergence causes listed below, the fix-shape conclusion
> (front-end rule, not hardened asserts), and the practical checks — with "diff the code shape" demoted from a test of failure identity to a
> weak hint about shared provenance.

Triaging shader-slang/slang#8785 I reported **three** apparent defects: a SPIR-V ICE (`slang-ir-glsl-legalize.cpp:5240`), a Metal ICE (`slang-ir-legalize-varying-params.cpp:4566`), and a release-build SIGSEGV (exit 139) in `slangc 2026.13.1`. They are **one** defect. Verified line-for-line at HEAD `546ad18f7` — both sites run the identical five steps in identical order:

| step | spirv `glsl-legalize` | metal `varying-params` |
|---|---|---|
| `SLANG_ASSERT(call->getArgCount() == 4)` | `:5235` | `:4561` |
| `getArg(3)` | `:5236` | `:4562` |
| `composeGetters<IRPtrType…>(payload, &IRInst::getDataType)` | `:5238` | `:4564` |
| `SLANG_ASSERT(payloadPtrType)` | `:5240` | `:4566` |
| **`payloadPtrType->getValueType()`** | **`:5241`** | **`:4567`** |

When the `DispatchMesh` payload is an entry-point *parameter* (not a groupshared global), it isn't a pointer type, so `composeGetters` returns null. In a Debug build the assert catches it; in a Release build `SLANG_ASSERT` compiles to `SLANG_ASSUME` (`source/core/slang-common.h:364` vs `:371`) so **the same null is dereferenced one line later** — that is the segfault. ~~**One null, two build configurations, three apparent symptoms.**~~ ❌ **FALSE — see banner. spirv fails on ARITY and never reaches this null; metal is the only null.**

**RULE (⚠️ SUPERSEDED as a test of failure identity — see the banner; keep it only as a hint that two sites share provenance): before scoping a fix per symptom, check whether the sites are the same *code shape*.** Two things make symptom-count diverge from defect-count, and both are common:
1. **Debug-assert vs release-UB of one invariant** files as two bugs (an "ICE" ticket and a "segfault" ticket) with different severities and often different owners.
2. **Per-backend legalization passes that were copy-adapted** hit the same precondition at different file:line, so a per-target grep yields N hits that look independent.

**Why it changed the fix, not just the bookkeeping.** With N=3 the natural move is hardening each assert (add null checks / bail out). With N=1 that's clearly wrong: just past the assert, `glsl-legalize:5244-5247` computes `isGroupsharedGlobal` and branches on it with **no non-groupshared-global path at all** — the pass is written for one input shape only. So hardening would harden a site that should never be reached and leave the invalid IR state legal. The correct fix is one front-end rule that rejects the input up-front, making every downstream site unreachable — which also removes two *silent* miscompiles (HLSL emitting writes into a read-only cbuffer; GLSL into a push-constant block) that no assert would have caught.

**Practical checks:** diff the surrounding ~10 lines of each assert site rather than comparing the assert text; always run the **release** build too (a "debug-only assert" can be a shipped segfault); and when a pass asserts on an input shape, look for the branch just past it — if it only handles one shape, the producer or the front end is the right layer, not the assert.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785804467761-n-crash-signatures-is-a-hypothesis-about-count-not.md`_
