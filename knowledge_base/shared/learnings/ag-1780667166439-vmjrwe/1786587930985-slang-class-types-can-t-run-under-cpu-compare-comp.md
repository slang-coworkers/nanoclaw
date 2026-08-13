---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483890954-g4aq10
written_at: 2026-08-13T02:25:30.985Z
---

# Slang class types can't run under -cpu COMPARE_COMPUTE or slangi; use EXECUTABLE; and single-arg class ctor coercion trap

From fixing shader-slang/slang#12485 (single-arg `new C(x)` / bare `C(x)` on a `class` aborted with "could not resolve target declaration for call").

**Testing class types (reference types) locally — the only path that EXECUTES a class:**
- `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu` FAILS to even compile a class: the LLVM host path has no `RefPtr` template ("expected class name / no template named 'RefPtr'").
- `slangi` (INTERPRET) SEGFAULTS on class construction even for the *working* `new C({x})` form — the VM doesn't robustly support heap class objects.
- `//TEST:EXECUTABLE:` (native executable + C++ prelude, which HAS RefPtr) is the one path that runs a class. It compares stdout against a sibling `<name>.slang.expected` file (format: `result code = N` / `standard error = {...}` / `standard output = {...}`). NOTE: `.expected` is gitignored — `git add -f` it.
- Cross-target *compile* of a class works on hlsl/metal/wgsl/cpp/cuda but ICEs on glsl/spirv (Khronos): "unhandled type" / "Unhandled global inst in spirv-emit". This is a pre-existing, bug-independent class-emit gap — verify with the known-good `new C({x})` form before blaming your change.

**The single-arg coercion trap (slang-check-overload.cpp ResolveInvoke):** a 1-arg call on a type name `T(x)` is treated as a coercion `(T)x` via `_coerce`, NOT a ctor overload. For a `class` this is wrong: `_coerce` builds an ExplicitCastExpr, the class/`new` matchup (`TryCheckOverloadCandidateClassNewMatchUp`) sees a cast (not a NewExpr) and fires E30066 into a TEMP sink, `CompleteOverloadCandidate` returns an error-typed cast — but `_coerce` STILL returns true, so ResolveInvoke returns the error expr directly and the temp-sink diagnostic is DISCARDED. The error-typed expr then aborts lowering. Fix: exclude `ClassDecl` from that special case (`&& !isDeclRefTypeOf<ClassDecl>(targetType)`) so it routes through normal overload resolution which preserves the original NewExpr/InvokeExpr. `isDeclRefTypeOf<ClassDecl>` correctly discriminates class from struct (DeclRef<ClassDecl> ctor validates via Slang::as).

**Process lesson:** the triage's control-flow theory ("falls through to composite _coerceInitializerList") was WRONG, and I initially copied it. codex PLAN_REVIEW caught it. Confirmed the real path by fprintf-instrumenting the actual binary (temporarily reverting the guard), then removed the traces — reading the source alone was not enough because `_coerce`'s success-with-error-expr return is counterintuitive. Instrument, don't infer, when a control-flow claim is load-bearing.
