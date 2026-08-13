---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483890954-g4aq10
written_at: 2026-08-13T03:48:01.454Z
---

# Excluding a class from Slang's single-arg coercion fast-path: narrow to construction only (new OR differing-arg-type), not blanket

Follow-up to fixing shader-slang/slang#12485. The fix excludes `class` from `ResolveInvoke`'s single-argument coercion fast-path (slang-check-overload.cpp ~3435) so single-arg class construction routes to overload resolution instead of aborting. TWO regressions hid behind the naive versions of this exclusion — both caught only by adversarial review + running a built binary, NOT by reading:

1. **Blanket `!isDeclRefTypeOf<ClassDecl>` breaks class IDENTITY casts.** The fast-path's documented purpose is identity casts `(C)c` / `C(c)` where the arg is already `C` — handled as a no-op by `_coerce`'s `toType->equals(fromType)` early-return (slang-check-conversion.cpp:1798), never reaching the ctor/matchup. A blanket class exclusion reroutes them through overload resolution, which rejects them (E30066). This is a REGRESSION of previously-valid code. (Peer reviewer / Devin caught it; a confidence-25% "intended" drop by another reviewer was wrong.)

2. **Gating only on `!targetType->equals(arg->type)` then breaks `new C(c)` copy construction.** If you narrow to "exclude class from fast-path only when arg type differs", then `new C(existing)` with a user `__init(C other)` is misclassified as identity (arg IS C) → stays on fast-path → `_coerce` returns the arg unchanged → the copy constructor is silently BYPASSED (returns the original, not a constructed copy).

**Correct condition:** a `new` is ALWAYS construction; a non-`new` same-type call is identity:
```
bool isClassConstruction = isDeclRefTypeOf<ClassDecl>(targetType) &&
                           (as<NewExpr>(expr) || !targetType->equals(expr->arguments[0]->type));
```
Exclude only `isClassConstruction` from the fast-path.

**Verification that catches both:** a class with an OBSERVABLE `__init(C other){ v = other.v + 1000; }`, then `new C(orig)` must change the value (proves construction, not no-op), while `(C)orig`/`C(orig)` must preserve it (identity). Testing only distinct-arity ctors (e.g. `__init(int)`, `__init(int,int)`) passes silently through both bugs — the reviewer's key point: the newly-activated overload path needs competing-candidate + same-type-arg coverage.

**N/A traps to save time:** class inheritance is unsupported in Slang (E30832) so subtype casts aren't a concern; generic classes don't parse (`class Box<T>` → E20001 "unexpected '<'"), only generic structs — so there's no specialized-generic-class discriminator case.
