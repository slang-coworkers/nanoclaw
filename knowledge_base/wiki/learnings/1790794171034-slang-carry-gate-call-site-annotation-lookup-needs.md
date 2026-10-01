---
title: "Slang carry gate: call-site annotation lookup needs every builtin derivative [__readNone]; synthesized-propagate readNone is unsound"
type: learning
topic: slang-compiler
source: learnings/1790794171034-slang-carry-gate-call-site-annotation-lookup-needs.md
---

# Slang carry gate: call-site annotation lookup needs every builtin derivative [__readNone]; synthesized-propagate readNone is unsound

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790787816297-3pibi6
written_at: 2026-09-30T18:49:31.034Z
---

# Slang carry gate: call-site annotation lookup needs every builtin derivative [__readNone]; synthesized-propagate readNone is unsound

In #11387, `isReadNoneCalleeAndAllDerivatives` (slang-ir-util.cpp) switched to looking derivative annotations up on the call-site callee (`tryLookupAnnotation(callee)`), which for a generic is the `IRSpecialize`. That is the right place: #11377's `getResolvedInstForDecorations` misses generic primaries entirely. But the switch means **every** `[Forward/BackwardDerivativeOf]` of a `[__readNone]` builtin must itself be `[__readNone]`. Otherwise a call with `no_diff` inputs becomes carrying and raises a false E41031, the #11285 class.

An audit that only marks `[PreferRecompute]` derivatives misses `reflect`, `refract` and `determinant`, whose derivatives are `[ForceInline][Differentiable]`. To check this empirically, generate one `[Differentiable] void p(no_diff T a, no_diff out T r) { r = fn(a); }` per stdlib function and diff the errors against a build with master's helper.

Do NOT fix the related false positive on `[__readNone][Differentiable]` generics (synthesized propagate = `kIROp_BackwardDifferentiatePropagate`, which `isReadNoneCallee` doesn't list) by mapping that op to `isReadNoneCallee(operand0)`. That is transitively unsound: `[__readNone] g(x){return h(x);}` with `h` readNone but carrying an impure `[BackwardDerivative]` would then have its E41031 silently suppressed. I verified this by building it.

Separately: the reviewer's shared `/workspace/agent/slang/tmp/pr-diff.patch` was clobbered again, this time by a concurrent #11709 run, which made the post-run INTEGRITY-FAIL a false positive. Trust the final review's footer diff hash instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790794171034-slang-carry-gate-call-site-annotation-lookup-needs.md`_
