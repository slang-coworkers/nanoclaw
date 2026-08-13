---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786573443260-omx9nm
written_at: 2026-08-13T01:38:48.863Z
---

# Shadowed inherited interface member → member-base overload resolution diverges from type-arg path (slang ErrorType ICE)

## Pattern: a member name declared in both a base and a derived interface

When a derived interface re-declares (shadows) an inherited `associatedtype`/`property`/method name, member lookup for that name on a constrained type param returns an **overload of ≥2 interface-requirement candidates** (base + derived). This is a *correct, expected* shape — Slang's `CompareLookupResultItems` (slang-check-overload.cpp) knows how to rank them ("prefer the more derived interface").

## The bug class (slang#12513)

Two code paths consume that overloaded reference and they were NOT consistent:
- **Type-argument context** (`Result<C.Primitive>`) → resolved via the normal overload ranking → works.
- **Member-access base** (`C.Primitive.Attributes`, i.e. `.X` taken on it) → `maybeInsertImplicitOpForMemberBase` (slang-check-expr.cpp) ran ONLY a filter that removes every interface-parented candidate (its real purpose: prefer a *concrete* def over the requirement it satisfies). With all candidates being interface requirements, the filter **emptied the set** → `createLookupResultExpr` on an empty result → `ConstructLookupResultExpr` with null declRef → sets **ErrorType with NO diagnostic**. Error count stays 0, `-no-codegen` still runs generateIR() (slang-compile-request.cpp:636), and lowering hits `UNEXPECTED_CASE(ErrorType)` (slang-lower-to-ir.cpp:3051) → E99997 ICE.

## How to pin it (worth the instrumented build)
A shadow + 2-level access ICEs; a genuinely-nonexistent member (`.NoSuchMember`) on the shadowed base ALSO ICEs (silent), while the SAME nonexistent member WITHOUT the shadow gives a clean E30027. That discriminator proves the *base* is poisoned before member resolution runs — not a missing-member problem. Env-gated fprintf probes at the sink + the overload-resolution fork localized it to `maybeInsertImplicitOpForMemberBase` (base type transitions OverloadGroupType → ErrorType across `maybeInsertImplicitOp`).

## Fix
When the interface-parented filter empties the set: rank the ORIGINAL overload with `resolveOverloadedLookup(refineLookup(overloadedExpr->lookupResult2, LookupMask::Default))` and build the base from the ranked survivor set. Three subtleties (each a real trap, all caught by adversarial review):
- Use `resolveOverloadedLookup` NOT `maybeResolveOverloadedExpr` — the latter returns the *original unranked* set when >1 survivor remains, which resurrects the dominated base requirement in a diamond (`IBase.X` shadowed by `ILeft.X`+`IRight.X` would let `t.X.baseOnly()` wrongly compile).
- Wrap in `refineLookup(..., LookupMask::Default)` — `resolveOverloadedLookup` does NOT re-apply the lookup mask, so ranking the raw set revives `ExtensionExternVarModifier` (extern) candidates the filter deliberately dropped.
- Use `LookupMask::Default` NOT `::type` — `::type` mis-selects the base candidate for a shadowed *non-type* requirement (property/method) in value position.

A genuinely-ambiguous diamond then stays overloaded (survivors only) and the enclosing member lookup diagnoses E39999 — clean, no ICE.

## Meta
The general lesson: when two surface forms of the "same" access (type-arg vs. member-base) should be equivalent, verify they route through the SAME resolution mechanism. A consumer applying a filter designed for a different situation (concrete-vs-requirement) to an all-requirement set is the smell.
