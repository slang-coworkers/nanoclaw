---
title: "Slang: synthesized $init ctors get full source-level SPIR-V debug info (no synthesized-func filter)"
type: learning
topic: slang-compiler
source: learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md
---

# Slang: synthesized $init ctors get full source-level SPIR-V debug info (no synthesized-func filter)

Issue #11550: with `-g2 -O0`, a struct initializer-list (`Pair p = {1,2}`) synthesizes a member-wise `$init` ctor that emits a full source-level debug scope — `DebugFunction`/`DebugFunctionDefinition`/`DebugScope` plus `DebugLine`s mapped to the struct decl line and member decl lines — so a debugger steps INTO the synthetic init.

**Why it happens:** The synthesized ctor inherits the struct's source loc (`createCtor`: `ctor->loc = decl->loc`, slang-check-decl.cpp:2927) and its member-store stmts inherit each member field's loc (`synthesizeCtorBodyForMemberVar`: `stmt->loc = varDeclBase->loc`, :13602). It's then lowered like any user function, so `maybeAddDebugLocationDecoration` (slang-lower-to-ir.cpp:13522) + the `DebugFunction` path (:14179-14202) give it a debug scope. DeepWiki claims the intended invariant is "synthesized funcs never get `IRDebugFuncDecoration`" — but that's FALSE here precisely because the synthesized ctor carries a *valid* struct loc. There is NO synthesized-function filter anywhere in debug-info emission (only `debugInfoLevel==None` and the strip-all pass).

**Markers to identify a synthesized initializer:** AST `ConstructorDecl::containsFlavor(SynthesizedDefault | SynthesizedMemberInit)` (slang-ast-decl.h:665-678; user ctors are `UserDefined=0`); IR `IRConstructorDecoration::getSynthesizedStatus()` (slang-ir-insts.h:890,894), attached at slang-lower-to-ir.cpp:13851-13854 — but that's AFTER the func debug decoration at :13522, so gate on the AST flavor during lowering, not the IR decoration.

**Cascade gotcha for any fix:** suppressing the function-level debug scope (DebugFunction) WITHOUT also suppressing the body `DebugLine`s (`maybeEmitDebugLine`, :9496-9528) leaves DebugLines with no enclosing DebugScope → likely INVALID NonSemantic debug SPIR-V. Function-level + body-level suppression must go together.

**Don't fix by nuking the AST locs** (the :2927/:13602 assignments) — those locs are almost certainly reused for diagnostics anchoring; cut at the debug-info layer (skip emission for synthesized ctors), not the loc producer.

Repro is compile-only (no GPU): `slangc repro.slang -target spirv-asm -g2 -emit-spirv-directly -O0 -o out.spv-asm` then grep for `Pair.$init` / `DebugLine`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md`_
