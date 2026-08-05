---
title: "An IR op being MENTIONED in a consumer is not the same as HANDLED — read the branch body"
type: learning
topic: slang-compiler
source: learnings/1785857072008-an-ir-op-being-mentioned-in-a-consumer-is-not-the-.md
---

# An IR op being MENTIONED in a consumer is not the same as HANDLED — read the branch body

## The rule

When you migrate between enum/op variants (param passing modes, IR ops, type kinds), grepping that the destination op is **mentioned** in every downstream consumer proves only that it *reaches* that code. It says nothing about whether the handling is **equivalent** for the property you care about. Read every destination branch body and diff the behaviour.

## The case (shader-slang/slang PR #11709, 2026-08-04)

Planning to switch a bare `groupshared` parameter from `ParamPassingMode::BorrowInOut` to `Ref`, I grepped the groupshared-critical files and found all three param-mode ops present in every consumer:

```
slang-ir-inline.cpp:1060:        case kIROp_RefParamType:
slang-ir-inline.cpp:1066:        case kIROp_BorrowInParamType:
slang-ir-inline.cpp:1067:        case kIROp_BorrowInOutParamType:
```

I concluded "mode-agnostic, safe to switch." That was the load-bearing claim of the plan, and it was wrong. The branch body:

```cpp
case kIROp_RefParamType:
    if (callee->findDecoration<IRNoRefInlineDecoration>())
        return false;
    return true;              // force-inline; NEVER consults IRNoInlineDecoration
```

`Ref` is force-inlined regardless of `[noinline]` — it honours only the *narrower* `IRNoRefInlineDecoration`. The Borrow ops take a conditional path that bails out when the argument roots at a var/global, which is precisely **why `[noinline]` works for them today**.

Empirical confirmation, `__ref groupshared uint a[8]` + `[noinline]`:

| | `__ref groupshared` | `__constref groupshared` |
|---|---|---|
| CUDA | callee **absent** — force-inlined away | `uint f_0(FixedArray<uint,8>* a_0)`, called `f_0(&g_0)` ✅ |
| direct SPIR-V | **0** `OpFunctionCall`, no `VariablePointers` | boundary preserved ✅ |

So the switch would have destroyed exactly the `[noinline]` boundaries that three diagnostics (E30708/E30709/E30710) had just been shipped to protect. Caught by a codex PLAN_REVIEW before the 20-minute build.

## Why it's easy to miss

Sibling `case` labels are the most misleading shape in a switch: adjacency reads as uniform treatment, and a fallthrough group (`case A: case B:`) sitting next to a standalone `case C:` is exactly where the asymmetry hides. The grep output above *looks* like three equally-handled ops on consecutive lines.

## How to apply

- Migrating X→Y: name the property explicitly ("does the `[noinline]` boundary survive?"), then read Y's branch body and confirm it preserves that property. Presence is not the question.
- Get a **two-sided empirical control**. Here the contrast (`__ref` destroys the boundary, `__constref` preserves it) *is* the finding — either measurement alone proves nothing.
- Treat any grep-based clearance of a migration as a **hypothesis** and label it as such in the plan. Mine read as a settled fact in my own writeup.
- Same family as the inert-test trap: skipped test / stale binary / vacuous assertion / dead flag / op-present-but-handled-differently are all "present but not exercising." Ask which behaviour would **change**, not which symbol appears.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785857072008-an-ir-op-being-mentioned-in-a-consumer-is-not-the-.md`_
