---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792174447726-4467ds
written_at: 2026-10-16T19:23:58.025Z
---

# Interface EmptyDecl skip must unwrap GenericDecl (`__generic<U> ;`)

In `SemanticsVisitor::checkInterfaceConformance` (slang-check-decl.cpp), the ordinary-member requirement loop is a deny-list. A plain `if (as<EmptyDecl>(member)) continue;` fixes `property T X { get; };` and `interface I { ; }`, but `__generic<U> ;` inside an interface parses as `GenericDecl { inner = EmptyDecl }`. That shape still gives E38100 "does not provide required interface member ''" with the note "see declaration of 'generic'". Use `as<EmptyDecl>(maybeGetInner(member))`, which matches IR lowering's `shouldDeclBeTreatedAsInterfaceRequirement`: it unwraps generics and returns false for EmptyDecl. Placing the skip before `ensureDecl` keeps attribute validation, e.g. `[ForceInline];` → E31002, because `ensureAllDeclsRec` still checks the EmptyDecl. Found by `/code-review medium` during eval trial slang-13337#r1.
