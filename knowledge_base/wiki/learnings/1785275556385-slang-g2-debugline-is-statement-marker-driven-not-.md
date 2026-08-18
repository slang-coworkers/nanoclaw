---
title: "Slang -g2 DebugLine is statement-marker driven, not per-value-inst sourceLoc"
type: learning
topic: slang-compiler
source: learnings/1785275556385-slang-g2-debugline-is-statement-marker-driven-not-.md
---

# Slang -g2 DebugLine is statement-marker driven, not per-value-inst sourceLoc

# Setting a value-inst's sourceLoc does NOT change emitted SPIR-V debug lines

When "fixing source-location hygiene" in a Slang IR pass by propagating `sourceLoc` onto
re-synthesized value instructions (e.g. via `IRBuilderSourceLocRAII` so `_maybeSetSourceLoc`
stamps them), be aware: **this has NO effect on emitted `-g1 OpLine` / `-g2 DebugLine` output.**

**Why:** `-g2 DebugLine` (and `-g1 OpLine`) are emitted ONLY from explicit `IRDebugLine` MARKER
instructions (slang-emit-spirv.cpp, `if (opCode == kIROp_DebugLine)`). Those markers are placed at
**statement granularity at the frontend** (slang-lower-to-ir.cpp `lowerStmt` → `maybeEmitDebugLine`,
keyed to `stmt->loc`). Function-body value insts (OpAccessChain/OpLoad/etc.) do NOT independently
emit a DebugLine from their own `sourceLoc` during SPIR-V emit — they just fall under whatever the
last statement marker was.

**Consequence:** A revert-drill (unfixed vs fixed binary) on `-g1/-g2/-g3 -emit-spirv-directly`
shows BYTE-IDENTICAL SPIR-V even when your fix demonstrably sets the loc at the IR level. So a
"-g2 golden that the fix changes" as proof-of-effect is IMPOSSIBLE for a pure value-inst sourceLoc fix.

**The only consumers that surface a value-inst's sourceLoc** are diagnostic sites that read
`inst->sourceLoc` (or `findFirstUseLoc(inst)` as fallback) directly — e.g. the four sites in
slang-ir-check-unsupported-inst.cpp, or a target-emit abort/diagnostic. If no such diagnostic fires
on your input, a sourceLoc-hygiene fix has zero observable surface and no writable test.

**Lesson (slang#12192):** Before committing to a sourceLoc-propagation fix + a debug-info golden,
BUILD it and run the revert drill. If `-g2` is byte-identical, the golden can't exist — surface to
the maintainer rather than shipping an untestable change (methodology: "name the test that fails
without the change"). Also verify the triaged synthesis site is actually on the value's lowering
path (instrument with a temporary fprintf probe); triage file:line attributions can be imprecise —
in #12192 the real producer was `deferStorageToLogicalCasts`, not the cited
`materializeStorageToLogicalCastsImpl`/`lowerMatrixAddresses`.

**Build gotcha:** slangc links `libslang-compiler.so`, not `libslang.so`. An incremental
`cmake --build --target slangc` may relink stale objects without recompiling your edited TU — verify
your change is actually in the binary (`strings build/Debug/lib/libslang-compiler.so.* | grep <probe>`)
before trusting a "no diff" result. `-dump-ir` does NOT print source locations, so identical IR dumps
are uninformative about whether a loc was set.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785275556385-slang-g2-debugline-is-statement-marker-driven-not-.md`_
