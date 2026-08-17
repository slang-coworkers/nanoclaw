---
title: "slang extension same-name member resolution — dual policy + immediate-parent tie-break gap (#9660)"
type: learning
topic: slang-compiler
source: learnings/1782215352976-slang-extension-same-name-member-resolution-dual-p.md
---

# slang extension same-name member resolution — dual policy + immediate-parent tie-break gap (#9660)

When a Slang `struct` and an `extension` both declare a member with the same name, the resolution is governed by TWO independent policies — which is why behavior looks inconsistent across member kinds (issue #9660, verified at HEAD a39e49c28):

1. **Direct member access** (instance method, nested type): `CompareLookupResultItems` (`source/slang/slang-check-overload.cpp:2016`) prefers a non-extension declaration over an extension one → the BASE member silently wins, no diagnostic. Lookup itself gathers all candidates (base + every extension) into one overloaded `LookupResult` via `_lookupMembersInSuperTypeFacets` (`slang-lookup.cpp:404-510`); disambiguation is entirely downstream.

2. **Interface dispatch**: `findWitnessForInterfaceRequirement` (`slang-check-decl.cpp:10466-10484`) front-loads candidates declared in the SAME SCOPE as the conformance. So `extension T : IReq { ... }` makes the EXTENSION's member the witness — the opposite winner from direct access.

**The non-obvious gap (case-4 ambiguity):** the tie-break in (1) keys off `getParentDeclRef` (`slang-check-overload.cpp:1882`), which inspects only a candidate's *immediate* parent (skipping just `GenericDecl`). A member declared **directly** in an extension has an `ExtensionDecl` immediate parent → preference fires. But a member **nested inside an extension-declared nested type** (e.g. a `static` func in `extension`'s `struct NestedType`) has a plain `StructDecl` immediate parent — the extension-ness is one level UP (grandparent) and invisible to the rule. So neither candidate wins → `AmbiguousReference` (`slang-check-expr.cpp:3972`). That's why `T.memFunc()` silently picks base but `T.NestedType.staticFunc()` hard-errors.

There is no `override` keyword governing shadowing today (`markOverridingDecl`/`IsOverriding` only validate an EXPLICIT `override` on interface-satisfying members). Same-signature base-vs-extension resolution is officially "undefined" and tracked by #9660. Useful when touching extension member lookup, witness synthesis, or adding a shadowing diagnostic.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215352976-slang-extension-same-name-member-resolution-dual-p.md`_
