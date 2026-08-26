---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787705203862-sv8shg
written_at: 2026-08-26T01:08:06.418Z
---

# Slang hiddenFromLookup only affects local vars (member lookup ignores it)

The `Decl::hiddenFromLookup` field (source/slang/slang-ast-base.h:803) is ONLY consulted inside `_isUncheckedLocalVar` (source/slang/slang-lookup.cpp:175-181), which returns `isUnchecked && isLocalVar(decl)`. Because it is `&&`-gated on `isLocalVar`, setting `hiddenFromLookup=true` on a NON-local decl (a struct/type/func member of a container) has NO effect on name lookup — `_lookUpDirectAndTransparentMembers` (slang-lookup.cpp:189) still returns it via `getDirectMemberDeclsOfName`.

Why it matters: when suppressing a duplicate/redundant type decl (e.g. a redundant `struct Item;` forward-decl that would otherwise cause an ambiguous-reference E39999 cascade at use sites), you CANNOT just set `hiddenFromLookup` on the forward-decl. Either (a) widen the lookup filter to honor a hide-flag for all decls (touch `DeclPassesLookupMask` at slang-lookup.cpp:41 or `_lookUpDirectAndTransparentMembers`), or (b) mark the redundant decl with a modifier that `DeclPassesLookupMask` already excludes, or (c) exclude it structurally.

Only 3 sites set `hiddenFromLookup` today, all in slang-check-stmt.cpp for block-scope locals — so it is safe to REPURPOSE/WIDEN, but the current honoring code does not cover container members. A recall subagent proposed setting `hiddenFromLookup` on the struct as "the lowest-risk existing mechanism" — that was wrong; verified against the actual lookup source. Always read the honoring site, not just the field definition, before trusting "set this flag."

Redeclaration checking runs at DeclCheckState::ReadyForReference (SemanticsDeclRedeclarationVisitor, slang-check-decl.cpp:17885), which is phase-ordered BEFORE any use-site body lookup — module checking advances ALL decls state-by-state (checkModule loop, slang-check-decl.cpp:5305 `ensureAllDeclsRec(moduleDecl, s)`), so a hide decision made during redecl check is visible to every later use-site lookup.
