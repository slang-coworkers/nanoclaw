---
title: "Slang: when a check must 'mirror the fast path', SHARE the predicate, don't re-implement + comment it"
type: learning
topic: slang-compiler
source: learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md
---

# Slang: when a check must "mirror the fast path", SHARE the predicate, don't re-implement + comment it

On slang#11877 PR #12162 (a `pr: breaking change` adding a declaration-site diagnostic that must reject "exactly what the builtin-operator fast path shadows"), the reviewer (A+C+Devin converged) made a HIGH-priority gate of this: any logic whose correctness rests on "this stays identical to that other site" must be a SHARED function both sites call — not two copies that "match today" with a comment saying so.

Concretely: the per-operator element-eligibility ladder (bitwise/shift→int; equality→int|float|bool; logical-not→bool; arithmetic/ordering/negate→int|float) was written 3× (fast-path binary, fast-path unary, the new decl check). They matched, but nothing PINNED them — a future fast-path change (new comparison kind, bitwise-on-bool, changed `~`) would silently drift them and the new diagnostic would over/under-fire with no failing test. Fix: extract ONE predicate `isBuiltinOperationKindEligibleForBaseType(BuiltinOperationKind, BaseType)` next to the operator→kind mapping (`getBuiltinOperationKindFromString`), have all 3 sites call it. Same treatment already given to the broadcast oracle `getBuiltinArithmeticCommonType` (which I'd promoted from SemanticsExprVisitor to the shared SemanticsVisitor base for exactly this reason).

TRANSFERABLE RULES:
- "Mirror X exactly" is a code-sharing requirement, not a commenting one. If you catch yourself writing "// matches the fast path's gate", that's the signal to extract the shared function instead.
- Place the shared predicate next to the related mapping/utility it belongs with (co-locate the operator→kind map and the kind→eligibility rule), reachable from all caller TUs — often a base class (`SemanticsVisitor`) or an ast-support/util header.
- Harden the shared predicate: explicit cases + `SLANG_UNEXPECTED` (which is `[[noreturn]]` via handleSignal) for out-of-contract inputs, rather than a `default:` that silently returns a plausible value.
- Also: the one genuinely-NEW (non-mirror) piece of a function is where tests are most needed — here the instance-method `this`-receiver-as-operand logic had zero coverage while all the mirror logic was tested. Reviewers flag untested novel branches even when the mirrored parts are well-covered.
- Extracting a shared predicate touches a widely-included header → expect a broad recompile + run the broad regression sweep (it was behavior-neutral: 4294/4294).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md`_
