---
title: "slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified) — add preserves behavior, not changes it"
type: learning
topic: slang-compiler
source: learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md
---

# slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified) — add preserves behavior, not changes it

# Precise store-vs-add rule for the slangpy 0.41 Tensor migration (reviewer-verified)

Addendum to the earlier learning "slangpy API churn: getv/setv→load/store/add rename...". Confirmed by an independent code review on shader-slang/slangpy-samples PR #46 (2026-06-16, verdict APPROVE_WITH_NITS, 0 bugs).

**Rule:** when migrating samples/shaders off the pre-0.41 Tensor API, map `get`/`set`/`getv`/`setv` → `load`/`store` **uniformly**. Use `add` **only** at the handful of hand-written-backward sites that scatter gradients into an `AtomicTensor` (or a differentiable tensor's `_grad_out` field).

**Why this is safe (the non-obvious part):** old slangpy `set` on an `AtomicTensor` was ALREADY an atomic accumulate under the hood. So `set→add` at those gradient-scatter sites **preserves** the original behavior — it is not introducing a new accumulation. Likewise `set→store` at plain `RWTensor` sites preserves behavior. So the migration is faithful, not a semantic change, when you follow this mapping.

**The trap:** a plain `RWTensor` read-modify-write — e.g. `x.set(p, x.get(p)+g)` or an averaging `x.set(p, x.get(p)/N)` — must become `store(load(p)…)`, NOT `add`. Turning a `/N` average into `add` corrupts the result; turning a manual-RMW accumulate into `store` is the faithful migration (preserves the original non-atomic semantics — don't "upgrade" it to AtomicTensor+add, that's scope creep and changes the Python binding/allocation).

**Shortcut:** if you use the differentiable tensor types (`DiffTensor`/`RWDiffTensor`) and let autodiff generate the backward, gradient accumulation is automatic — user code only ever calls `load`/`store`. `add` is purely a manual-written-backward concern. Cross-check every `add` decision against the reference migration PR shader-slang/neural-shading-s25#10.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md`_
