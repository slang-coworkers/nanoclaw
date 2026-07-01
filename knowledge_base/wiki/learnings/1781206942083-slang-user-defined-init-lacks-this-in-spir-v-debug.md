---
title: "Slang: user-defined __init lacks `this` in SPIR-V debug info — root cause + fix site"
type: learning
topic: slang-compiler
source: learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md
---

# Slang: user-defined __init lacks `this` in SPIR-V debug info — root cause + fix site

Issue shader-slang/slang#11565 (complement of #11550): with `-g2 -O0 -target spirv-asm`, a user-defined `__init` emits NO `this` debug record (no DebugLocalVariable/DebugDeclare/DebugValue for the object under construction), while a `[mutating]` method on the same struct does.

**Root cause (verified by source read @ HEAD 3cb03e5ff):**
- A constructor is lowered as a *value-returning* function — `this` is NOT a parameter but a synthesized local var: `slang-lower-to-ir.cpp:13839` `auto thisVar = subContext->irBuilder->emitVar(irResultType);` (the comment at :13827-13830 says so outright). Result: `%Simple__init = OpFunction %Simple`, type `%Simple %int %int`, params only the explicit args. A method's `this` is a real IRParam, name-hinted "this" at :13212-13214 (guarded by `info.isThisParam`).
- The SPIR-V debug-var pass `slang-ir-insert-debug-value-store.cpp` (`insertDebugValueStore`, line 106) emits debug vars from exactly two sources: (a) the params loop :122-178 (every IRParam → `emitDebugVar` + `copyNameHintAndDebugDecorations` :145 — this is why methods' `this` gets a DebugLocalVariable named "this"), and (b) the local-var loop :180-204, which tags an IRVar ONLY if it carries `IRDebugLocationDecoration` (gate at :188). The ctor's `thisVar` has neither a "this" name hint nor that decoration → skipped by both → no `this` debug info. (Also: the function itself must carry IRDebugLocationDecoration or the whole pass early-returns at :113-115 — ctor funcs do, since they get a DebugFunction.)

**Principled fix (Approach A):** at `slang-lower-to-ir.cpp:13839`, after emitting `thisVar`, add a "this" name hint (cf. `addNameHint` @:13212-13214) + an `IRDebugLocationDecoration` (reuse `maybeAddDebugLocationDecoration` @:9531, which reads `inst->sourceLoc`; set the builder loc to the ctor decl loc, NOT the struct decl line — that's the #11550 trap). The existing local-var loop then emits DebugLocalVariable "this" + DebugDeclare, and store-tracking (:206+) yields live `this.val` DebugValue updates — no emit/pass change. Scope to user `__init` vs synthesized member-wise inits via the `SynthesizedDefault` flavor at :13851-13854. The RVO branch :13835-13836 (`thisVal = returnDestination`) has no fresh local to tag — handle the `emitVar` case first.

**Rejected:** B = emit-time special-case in slang-emit-spirv.cpp (violates "keep emission simple"); C = synthesize in the debug pass (must re-derive the result var — A subsumes it).

**Meta:** This is part of an active SPIR-V debug-info polish sweep by author pdeayton-nv (siblings: #11550/PR#11555, #11563; prior closed: #9966, #10540, #9815, #10060, #9943). When triaging "debug info missing for X" in Slang, first ask: is X a real IRParam (→ gets debug var automatically) or a synthesized local (→ needs a name hint + IRDebugLocationDecoration to be picked up)?

**Test trap (from #11550):** `-g2` embeds the FULL source incl `//CHECK` lines as OpString, so naive CHECK/CHECK-NOT self-matches — match the real `OpExtInst ... DebugLocalVariable` line or `OpName %_dbgvar_this`, not the bare word "this". FileCheck not available in the agent build env; grep the spirv-asm output and rely on CI. formatting.sh needs clang-format 17.x.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md`_
