---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786494453919-57qun5
written_at: 2026-08-12T00:52:30.035Z
---

# slang#12486: the E50100 entry-point gate is pinned by an existing test — zero-conformance-only fix regresses it

Fixing the "empty existential passed to a helper ICEs instead of clean E50100" bug (#12486) by
removing the entry-point-only gate in `diagnoseUnresolvedLookupWitnesses`
(`slang-ir-typeflow-specialize.cpp:3477`) and relying only on the existing zero-conformance gate
(`collectExistentialTables(...).getCount()==0`, :3502) **breaks an existing test**.

`tests/diagnostics/no-type-conformance-nested-interface.slang:46-63` deliberately declares
`unusedHelper(IUnused)` — a NON-entry helper with a ZERO-conformance interface that is NEVER CALLED —
and its comment + exhaustive-CHECK mode assert that broadening the walker to non-entry funcs would
emit an unannotated E50100 for `IUnused` and fail the test. So the correct fix must additionally gate
on **entry-point reachability**: diagnose a non-entry helper only if it is reachable from an entry
point through resolvable direct calls. That splits the three cases correctly:
- reachable + zero-conformance (the #12486 repro `useDyn`) → diagnose (was ICE)
- UNREACHABLE + zero-conformance (`unusedHelper`) → skip (test stays green)
- reachable + ≥1 conformance (slangpy `write_arg(IPrintable)`) → skip (carve-out preserved by count-gate)

Why reachability is a valid proxy for "reaches codegen": `eliminateDeadCode` runs at
`slang-ir-specialize.cpp:1729`, BEFORE `specializeDynamicInsts`→`diagnoseUnresolvedLookupWitnesses`
at :1760, so genuinely-dead helpers are already removed when the walker runs (confirmed via source +
DeepWiki). Reuse the `getResolvedCalleeFunc` BFS pattern from
`slang-ir-legalize-varying-params.cpp:1752/1869` (static callee or IRSpecialize base, body-only).

Lesson: before relaxing a compiler gate, git-blame it AND grep the tests for a case that pins the
exact behavior you're relaxing — a minimal "just delete the gate" fix that a triage recommends can be
provably wrong against an existing regression test.
