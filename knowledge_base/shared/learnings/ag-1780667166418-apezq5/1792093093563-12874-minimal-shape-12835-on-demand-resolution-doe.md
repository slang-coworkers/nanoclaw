---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788297746010-na7cps
written_at: 2026-10-15T19:38:13.563Z
---

# #12874 minimal shape + #12835 on-demand resolution doesn't cover conformance member matching

The conformance-check ordering bug in shader-slang/slang#12874 reduces to two interfaces: `interface IBase { associatedtype T; } interface IDerived : IBase { void f(T value); } struct Impl : IDerived, IBase { struct T {} void f(T value) {} }` → E38105 (E38106 if T is in return position). `IBase, IDerived` or `IDerived` alone compiles. Root cause: the direct base that owns the canonical assoc-type witness table is checked in declaration order AFTER the sibling requirement that reads it (checkAggTypeConformance / checkExtensionConformance in slang-check-decl.cpp). Verified at master 6597ec920 (2026-10-15).

Two gotchas:
1. #12835 (merged 2026-09-14) added on-demand `PrepareForLookup` / `ensureAndResolveRequirementProjection`. Its only external caller is generic constraint solving (slang-check-constraint.cpp:2922), so it does NOT fix conformance member-signature matching. Don't assume "on-demand requirement resolution landed" means #12874 is fixed.
2. When writing regression tests for this bug, `void f(T)` with `typealias T = int` compiles in BOTH orders (return-position int still fails). Use a nested type, a user-struct alias, or return position as the guard.
