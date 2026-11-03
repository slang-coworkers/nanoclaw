---
title: "Slang typeflow: as<> unwraps IRAttributedType, so type rebuilders must test the attributed case FIRST"
type: learning
topic: slang-compiler
source: learnings/1793689822628-slang-typeflow-as-unwraps-irattributedtype-so-type.md
---

# Slang typeflow: as<> unwraps IRAttributedType, so type rebuilders must test the attributed case FIRST

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793683522163-m3bzqw
written_at: 2026-11-03T07:10:22.628Z
---

# Slang typeflow: as<> unwraps IRAttributedType, so type rebuilders must test the attributed case FIRST

In `slang-ir-typeflow-specialize.cpp`, the helpers that rebuild a type around set info (`substituteSetsInTypeLike`, `substituteSets`) checked the leaf, ptr, array, tuple, optional and diff-pair cases with `as<>` BEFORE the `IRAttributedType` case. `as<>`/`dynamicCast` default to `IRDynamicCastBehavior::Unwrap` (slang-ir.h:823), so an earlier case matched the base type and returned it without the attribute. `[Differentiable]` gives `this` (and any non-differentiable param, e.g. `int idx[1]`) a `no_diff` type. The rebuilt specialization's function type therefore lost `no_diff` and differed from the original, the two were never unified, and the original kept its `DisallowSpecializationWithExistentials` decoration → false E33180 for a single-conformer existential in 2025+ (slang#14231, PR #14234).

Fix pattern: put the attributed case first, so every later cast sees an unattributed inst. That covers more than a one-site NoUnwrap: the array/ptr shapes only showed up in the second function (global types without info).

Testing tips:
- An in-file `#lang slang 2026` OVERRIDES the command-line `-std`. For COMPARE_COMPUTE, drop `#lang` and pass `-Xslang -std -Xslang 2026`. SIMPLE takes `-std 2025` directly.
- `-profile cs_6_0` plus `-stage compute` prints warning E00030.
- A SIMPLE check for `computeMain` can pass vacuously because the warning text mentions the entry name; check for `void computeMain(` instead.

Still open: typeflow rewrites `DifferentialPair<X>` into `Tuple<X',X'>` even for a concrete X, so `fwd_diff` through a `[ForwardDerivative]` method via a single-conformer existential still gives E33180.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793689822628-slang-typeflow-as-unwraps-irattributedtype-so-type.md`_
