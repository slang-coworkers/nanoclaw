---
title: "slang#9660 extension shadowing — design-gated; override keyword already exists"
type: learning
topic: slang-compiler
source: learnings/1782216036396-slang-9660-extension-shadowing-design-gated-overri.md
---

# slang#9660 extension shadowing — design-gated; override keyword already exists

Investigating slang#9660 (inconsistent override/shadowing when an `extension` re-declares a base struct's member). Verified at HEAD a39e49c28; this refines the prior `#9660 dual-policy` learning with three non-obvious facts that change scoping:

1. **`override` ALREADY exists** (`OverrideModifier`, registered `slang-parser.cpp:10819`) — but governs **interface-requirement satisfaction only** (a member satisfying a requirement that has a *default* impl must be `override` or `MissingOverride` fires; `markOverridingDecl` at `slang-check-decl.cpp:7666-7698`). It does NOT govern extension-vs-base shadowing. So the reporter's "add an `override` keyword" would *overload an existing keyword with a second meaning* (or need a new keyword) — a real design conflict, not a greenfield feature.

2. **The behavior IS documented in-tree as undefined** at `docs/language-reference/types-extension.md:129-130` (⚠️ warning: "when an extension and the base type contain a member with the same signature, it is currently undefined which member takes effect", cites #9660). Don't claim "undocumented"; it's documented-but-only-as-undefined.

3. **Same-name + DIFFERENT-signature** base+extension members are a SUPPORTED, tested overload-merge feature (`tests/.../extension-and-direct-member-merge-into-overload-set.slang`). Any shadowing diagnostic (the "Approach A" warning) must key on same name **AND overlapping signature**, never name alone, or it false-positives. Also exempt interface-satisfying members (case-2 extension-wins is intended, per `extension-override.slang`: direct-impl > direct-extension > generic-extension) and generic-default `extension<T:IFoo> T` members.

**Verdict: DESIGN-GATED.** The which-member-wins rule is a maintainer semantics call (routed to @tangent-vector); not a defect. Two deliberate policies cause all four observed behaviors: extension-preference in `CompareLookupResultItems` (`slang-check-overload.cpp:2016-2037`; the nested-*static* case hard-errors only because `getParentDeclRef:1882-1890` sees the immediate parent, not the grandparent extension) + witness front-loading in `findWitnessForInterfaceRequirement` (`slang-check-decl.cpp:10473-10511`). Do NOT implement a resolution change blindly. The only semantics-agnostic interim is a non-breaking WARNING diagnosing silent *unreachable* shadowing (with the exemptions above), and even that warrants maintainer scope confirmation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782216036396-slang-9660-extension-shadowing-design-gated-overri.md`_
