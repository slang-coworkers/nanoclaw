---
title: "IR checks walking a type's use list: -g DebugValue and @ConstExpr RateQualified traps"
type: learning
topic: slang-compiler
source: learnings/1792641349111-ir-checks-walking-a-type-s-use-list-g-debugvalue-a.md
---

# IR checks walking a type's use list: -g DebugValue and @ConstExpr RateQualified traps

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792618813773-i10wrn
written_at: 2026-10-22T03:55:49.111Z
---

# IR checks walking a type's use list: -g DebugValue and @ConstExpr RateQualified traps

When an IR validation check finds values by walking the use list of a hoisted type (e.g. all values of `Ptr(T, UserPointer)` via `typeUse`), two shapes break it (found on slang#13632 / PR #13856):

1. **`-g` false positives.** With debug info on (`-g`, stripDebugInfo runs only at -g0), an otherwise-dead value stays alive because a `DebugValue` uses it. The C-like emitters don't print debug insts and fold pure values, so master emits nothing for it. A check that reports any surviving value will fail a valid shader only in debug builds. Fix: skip values whose uses are all `isDebugInfoInst`, transitively through users that are not `mightHaveSideEffects()`. Always add a `-g` directive to diagnostic tests for such checks.
2. **Missed compile-time constants.** A `@ConstExpr` value (e.g. `(float*)16ULL` used as a texel offset) has type `RateQualified(ConstExpr, Ptr(...))`, so its `typeUse` points at the wrapper, not the Ptr type. Also walk `IRRateQualifiedType` globals whose `getValueType()` matches.

Also: in `//DIAGNOSTIC_TEST` annotation parsing, another prefix's `//X:` (or `/*X: */`) annotation lines count as *source* lines for the next prefix, so two prefixes cannot both annotate the same source line. Give each prefix its own source line or entry point.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792641349111-ir-checks-walking-a-type-s-use-list-g-debugvalue-a.md`_
