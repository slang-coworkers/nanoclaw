---
title: "Slang diagnostic severity is per-definition; diag=CHECK is exhaustive substring matching"
type: learning
topic: slang-compiler
source: learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md
---

# Slang diagnostic severity is per-definition; diag=CHECK is exhaustive substring matching

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788895609643-vairmk
written_at: 2026-09-08T21:29:01.686Z
---

# Slang diagnostic severity is per-definition; diag=CHECK is exhaustive substring matching

From fixing shader-slang/slang#12965 (surfacing a constraint-failed generic candidate in the E39999 "no overload applicable" note loop). Several non-obvious facts, verified against source + the built binary:

**1. Diagnostic severity is bound per-definition; you cannot downgrade a rich diagnostic to a note per-call.**
- Rich (lua-defined) diagnostics use `~name:Type` placeholders and are emitted via `getSink()->diagnose(Diagnostics::X{...})` → `diagnoseRichImpl(d.toGenericDiagnostic(), X::getInfo())`, where severity comes from the baked `getInfo()->severity`.
- The public positional `diagnose(pos, DiagnosticInfo copy, args...)` overload *does* take a copyable `DiagnosticInfo` (so you could flip `.severity`), BUT it routes through the non-rich formatter `formatDiagnosticMessage` which only substitutes `$0..$9` — it does NOT understand `~name:Type`, so a rich diagnostic emitted that way renders the literal `~name:Type` text. So per-call severity override does not work for rich diagnostics.
- `DiagnosticSink::overrideDiagnosticSeverity(id, sev)` exists but is a persistent, global, per-id remap (for `-Wno-`/`-Werror`), not a scoped tool.
- Consequence: to show an *error-severity* reason (e.g. E38029 "type argument doesn't conform") as a *note* attached to another error, you must add a note-severity companion diagnostic in `source/slang/slang-diagnostics.lua` (`standalone_note(...)`). This is an accepted pattern: the overload-candidate note family already does it — note `E40018` (overload-candidate-argument-type-mismatch) restates the same reason as primary error `E30019`. `err(...)`=error, `standalone_note(...)`/`note(...)`=note.

**2. `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` is NOT FileCheck — it is exhaustive substring matching (tools/slang-test/diagnostic-annotation-util.cpp).**
- Each `//CHECK:` line is matched as a substring against a diagnostic's **message OR errorCode OR severity OR "severity errorCode"** — NOT the rendered `error[Ennnnn]:` header. So `//CHECK: error[E39999]: no overload...` FAILS; use `//CHECK: no overload...` (message) and/or `//CHECK: E39999` (code) as separate lines.
- Each diagnostic is consumed by at most one annotation, so you cannot assert both the code and the message of the SAME diagnostic (two lines would need two diagnostics). Two identical diagnostics need two identical CHECK lines.
- SIMPLE mode is **exhaustive** by default: every emitted diagnostic must have an annotation or the test fails ("Found N diagnostic(s) without annotations"). Add `,non-exhaustive` to the directive to relax, e.g. `SIMPLE(diag=CHECK,non-exhaustive)`. Matching is order-independent.

**3. Overload-candidate dedup identity: use full `DeclRef`, not `Decl*` or the rendered signature.**
- The multi-candidate note loop in `ResolveInvoke` dedups by rendered signature string (comment explains: `getDecl()` strips substitutions so `foo<int>`/`foo<float>` share a `Decl*`).
- But the signature string also collapses distinct overloads with the same shape but different constraints (`h<T:IA>` and `h<T:IB>` both render `func h<T> -> T`), and `Decl*` collapses distinct specializations of one requirement inherited as `IBase<int>`/`IBase<float>`.
- `HashSet<DeclRef<Decl>>` is the correct substitution-preserving identity (already used in slang-check-inheritance.cpp) — distinguishes both while still collapsing the same candidate reached via multiple lookup paths.

**4. Constraint-failure kinds are recorded per-candidate.** `OverloadCandidate::genericInferenceFailure` (slang-check-impl.h) is a tagged union; `InterfaceConformanceNotSatisfied` is set in slang-check-constraint.cpp trySolveSubtypeWitnessForConstraint, `GenericConstraintNotSatisfied` is the general `where`-clause fallback. `CompleteOverloadCandidate` reads it on the single-candidate path (emits E38029/E30440); the multi-candidate note loop historically did not.

PR: shader-slang/slang#12969 (diagnostics-only; overload selection untouched).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md`_
