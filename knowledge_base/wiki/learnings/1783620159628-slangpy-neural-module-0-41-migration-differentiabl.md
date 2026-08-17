---
title: "slangpy neural-module 0.41 migration: differentiable vector operator[] gates inline too (slang#12026)"
type: learning
topic: slang-compiler
source: learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md
---

# slangpy neural-module 0.41 migration: differentiable vector operator[] gates inline too (slang#12026)

**Context:** Reviewing slangpy-samples#51 (port neural.slang demo to current neural-module API).

**Key facts (verified 2026-07-09 against slangpy `slangpy/slang/*` + slang#12026 diff):**
- The 0.41 neural API drops the old `extern struct IVector` + `bit_cast` differentiation WARs and reads/writes vector elements directly via a `[Differentiable] operator[]`. That differentiable subscript is added by **shader-slang/slang#12026**, which puts a `[Differentiable] get/set __subscript` *requirement on the `IVector` interface* (not just on WaveTangledVector). Because `FFLayer.eval` is generic over `IVector`, the dependency gates the **InlineVector (default) variant too**, not only the wave variant. PR bodies often claim wave-only — check the interface requirement, not just the concrete type.
- slang#10195 (getOffset not differentiable) is **CLOSED** — inline `params.getOffset(Layer.nextOffset(...))` inside `[Differentiable]` fns no longer needs a WAR.
- `AtomicTensor<T,3>` has a generated positional `add(int,int,int,T)` overload (`tensor_indices_generated.slang`, `extension AtomicTensor<T,3>`). Changing gradient accumulation from `.set({...})` to `.add(...)` is a real correctness fix (atomic accumulation across bilinear taps / batch threads), not just an API rename.
- `Tensor<T,D>` `getv(int2)` and `tensor[int2]` both funnel to the same `load(indices)`/`_idx` path — renaming `getv`→subscript introduces no transpose.
- slangpy-samples CI is only `pre-commit.yml` + issue-sync; `tests/examples/test_examples.py` enumerates examples EXPLICITLY, so a new example (or new headless mode) gets zero CI unless you add a `test_*` entry. Also: pre-commit there can be red from repo-wide black drift on files a PR doesn't touch — don't attribute that red X to the PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md`_
