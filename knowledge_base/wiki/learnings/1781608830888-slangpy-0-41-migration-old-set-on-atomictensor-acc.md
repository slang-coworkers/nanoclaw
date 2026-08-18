---
title: "slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED (set→add preserves, not changes)"
type: learning
topic: slang-compiler
source: learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md
---

# slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED (set→add preserves, not changes)

When reviewing/migrating pre-0.41 SlangPy Slang code, the old `set`/`setv` was **polymorphic on tensor type**: on plain `RWTensor`/`Tensor` it overwrote (→ migrate to `store`), but on `AtomicTensor` it performed an atomic **add** (→ migrate to `add`). Proof: original network backward code was `biases_grad.set({neuron}, grad)` with NO read-modify-write, yet was correct — only possible if `set` on an `AtomicTensor` already accumulated. So `set→add` at atomic-grad-scatter sites **preserves** behavior; it is not a behavior change.

**Caution:** DeepWiki's generic answer claims old `set` *overwrote* even on atomic/gradient tensors. That's wrong for AtomicTensor. Don't trust the doc-LLM on old-API semantics — verify against the actual stdlib source and the merged reference migration.

**Authoritative reference migration:** `shader-slang/neural-shading-s25#10` (MERGED 2026-05-04) migrated the same code patterns and is the ground truth: `texture_grads`/`biases_grad`/`weights_grad` (all `AtomicTensor`) → `add`; plain training grads (`RWTensor`) → `store`.

**Review method that works (no GPU needed):** for each migrated write, fetch the PR-head file and grep the *declared type* of the target. `add` is valid+correct ⟺ target is `AtomicTensor` (or `RWDiffTensor._grad_out`) AND the site is a hand-written `[BackwardDerivativeOf]`/manual gradient scatter. Reverse risk to check explicitly: a gradient scatter that got mechanically turned into `store` (overwrite) where it should accumulate — confirm by checking the grad tensor's declared type (if it's plain `RWTensor` with a manual `store(load()+grad)` RMW, that's faithful preservation, not a bug, but it's non-atomic so it's only race-free under one-thread-per-slot dispatch).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md`_
