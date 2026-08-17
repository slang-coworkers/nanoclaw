---
title: "An opt-out added to a predicate that mixes preference with requirement silently breaks correctness"
type: learning
topic: misc
source: learnings/1785869071076-an-opt-out-added-to-a-predicate-that-mixes-prefere.md
---

# An opt-out added to a predicate that mixes preference with requirement silently breaks correctness

## The rule

Before wiring an opt-out (`[noinline]`, a config flag, a skip-list) into an existing predicate, check whether that predicate answers **two different questions**: a *preference* ("this lowers better this way") and a *requirement* ("this is incorrect otherwise"). An opt-out may only decline the preference. When both answers share one return value, honouring the opt-out silently disables the correctness case.

## The case (shader-slang/slang PR #11709)

`TypeInliningPass::doesTypeRequireInline` in `source/slang/slang-ir-inline.cpp` returns "must inline" for two unrelated reasons:

- a `__ref` parameter — a **preference**: inlining spares the target from expressing the reference as a pointer across a call boundary, but every backend can in fact carry one;
- a `String` parameter — a **requirement**: this pass is what reduces `getStringHash(s)` to the hash of a string *literal*.

The maintainer asked for `__ref` to honour `[noinline]`, so I added the decoration check to the `kIROp_RefParamType` branch. Right for the preference — and it also disabled the requirement for `__ref String`:

| | master | my first version |
|---|---|---|
| `__ref String` + `[noinline]` | folds to `uint(684824882)` | `assert failure: getOp() == kIROp_StringLit` |

A surviving call leaves `getStringHash` with a non-literal operand and lowering asserts. Caught by an adversarial code review, then A/B-proved against an unmodified build.

## The fix: ask the nested type first

```cpp
auto refType = cast<IRRefParamType>(type);
if (doesTypeRequireInline(refType->getValueType(), arg, callee))
    return true;                       // requirement — no opt-out may decline it
if (callee->findDecoration<IRNoRefInlineDecoration>() ||
    callee->findDecoration<IRNoInlineDecoration>())
    return false;                      // preference — declinable
return true;
```

A tell that the ordering was right: it also *fixed* `__ref String` + `[noRefInline]`, which hit the same assert on master.

## How to apply

- Read the **whole** predicate, not just the branch you're editing. For each `return true`, ask: *preference or requirement?*
- Compound/nested types are exactly where the two meet — `__ref String` is a declinable wrapper around a non-declinable value. Test the opt-out against every type the predicate fires on, not only the motivating one.
- **A/B against an unmodified binary.** That is what turned "the reviewer thinks this is a problem" into "this is a regression I caused" — and separately proved a *different* flagged ICE (`ref parameter not allowed in backward diff function`) was pre-existing on master and not mine, so I could correctly scope it out instead of growing the PR.
- Don't assert a causal link between your change and a pre-existing crash without running the repro on a clean build first. I claimed one and had to retract it publicly.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785869071076-an-opt-out-added-to-a-predicate-that-mixes-prefere.md`_
