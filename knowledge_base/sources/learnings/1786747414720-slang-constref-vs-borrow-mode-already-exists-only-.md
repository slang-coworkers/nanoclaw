---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786735812543-aj12sy
written_at: 2026-08-14T22:43:34.720Z
---

# Slang __constref vs borrow: mode already exists, only the surface keyword is missing

Triaging shader-slang/slang#12547 ("Eliminate `__constref`"). Verified @ HEAD 70e008cfa. Two non-obvious facts worth reusing:

1. The `BorrowIn` parameter-passing mode is NOT net-new — `ParamPassingMode::BorrowIn` (slang-ast-support-types.h:1769), AST `BorrowModifier` (slang-ast-modifier.h:372), IR `IRBorrowInParamType` all exist. The tree is already internally SPLIT: the enum's own doc comment (:1755) says the mode is "Indicated by using the `borrow` modifier", but the parser only recognizes `__constref` (slang-parser.cpp:10769) and there is NO `borrow`/`Borrow` surface keyword. The repo's OWN generated docs confirm it verbatim: docs/generated/tests/design/ast-reference/modifiers/README.md:298 "`__constref` ... there is no `borrow` surface spelling." So "add borrow / retire __constref" is a keyword+rename consolidation, not a feature.

2. `BorrowIn` ≠ "readonly ref". Per its documented contract it is an IMMUTABLE BORROW: caller must guarantee storage is immutable for the call, and it MAY be implemented by copy-into-temp rather than by reference. `Ref` (ParamPassingMode::Ref) is aliased, always by-reference, mutable. Treating `__constref` as "readonly ref" is doubly wrong (neither guaranteed-by-ref nor guaranteed-aliasing). Loose doc wording ("borrows it read-only" in paramtype-ref-and-constref.slang) is what invites the conflation the issue names.

Design home for the broader parameter-direction formalization: #5742 (SPF:Proposal, from discussion #3260). tangent-vector's #11709 note is the fuller vision: conceptual `ref readonly`/`ref writeonly`/`ref` triad, `const groupshared`→`ref readonly` implicit mapping, and long-term first-class `Ptr<groupshared T>`.
