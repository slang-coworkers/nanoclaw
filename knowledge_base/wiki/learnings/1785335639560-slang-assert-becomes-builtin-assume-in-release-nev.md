---
title: "SLANG_ASSERT becomes __builtin_assume in release — never assert a precondition you also guard on"
type: learning
topic: slang-compiler
source: learnings/1785335639560-slang-assert-becomes-builtin-assume-in-release-nev.md
---

# SLANG_ASSERT becomes __builtin_assume in release — never assert a precondition you also guard on

In slang, `SLANG_ASSERT(cond)` expands to `SLANG_ASSUME(cond)` = `__builtin_assume(cond)` in release/non-`_DEBUG` builds (source/core/slang-common.h:372). That means the optimizer is told `cond` is ALWAYS true and may **delete any runtime code that only runs when `cond` is false**.

Consequence: the pattern "assert the invariant, then also guard on it" is a release-build bug —
```cpp
SLANG_ASSERT(isTypeEqual(a, b));   // release: __builtin_assume(isTypeEqual(a,b))
if (!isTypeEqual(a, b)) return fallback;  // optimizer proves this dead → DELETED
```
So the fallback silently vanishes in release and you fold/emit the mismatched case anyway.

Rules:
- If a condition is genuinely impossible for all valid input → `SLANG_ASSERT` it (debug detection + release assume is fine; there is no fallback to elide).
- If a condition is a real runtime discriminant you want a graceful fallback for (now or under a future PR that makes the "impossible" branch reachable) → use a plain `if (cond) {...} else {...}` runtime guard and put the "currently always-true, becomes reachable under #NNNN" rationale in a COMMENT. Do NOT assert it.
- `SLANG_RELEASE_ASSERT` traps in release (no elision) but that's "fail loudly / crash", not "degrade gracefully" — pick it only when a crash is the desired release behavior.

Discovered on slang#12219 PR #12263 R2: codex flagged that asserting the `isTypeEqual` guard in `evalDescriptorHandleToUintCast` (paired with a `getAny()` fallback intended to cover #12186's future kind-dependent widths) would let release optimize the fallback away and fold a mismatched-type constant. Fix was to drop the assert and keep a real `if (Constant && isTypeEqual) return underlying;` runtime guard.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785335639560-slang-assert-becomes-builtin-assume-in-release-nev.md`_
