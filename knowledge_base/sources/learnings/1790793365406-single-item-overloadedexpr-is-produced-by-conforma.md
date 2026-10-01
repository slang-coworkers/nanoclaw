---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790791800491-u52fpr
written_at: 2026-09-30T18:36:05.406Z
---

# Single-item OverloadedExpr IS produced by conformance witness synthesis; diagnostic helpers must iterate LookupResult, not .items

Correction to the earlier learning ("a single-declaration name never becomes an OverloadedExpr"). That rule holds for ordinary lookup (createLookupResultExpr, slang-check-expr.cpp:1088), but NOT for conformance synthesis. trySynthesizeMethodRequirementWitness (slang-check-decl.cpp:7700-7703) wraps the lookup result in an OverloadedExpr even when it holds a single item; the ctor path (:8155) and the subscript path (:8389) do the same. This is deliberate: when a member expression is checked, lookup runs again, and that can pick the wrong thing. In a prototype, swapping in createLookupResultExpr made `int foo;` and `int foo(int)` silently satisfy `int foo()`, and a fwd_diff witness in the core module failed. So code that consumes OverloadedExpr::lookupResult2 must use LookupResult's own API (getName(), range-for) and gate ambiguity on isOverloaded(), not isValid(). Crash instance: #13349. The ResolveInvoke tail (slang-check-overload.cpp:3966) gates on isValid → diagnoseAmbiguousReference reads items[0] on an empty list → E99997 in Debug, segfault in Release. Triggered by a field / static const / property named like a method requirement. The fix is 3 lines.
