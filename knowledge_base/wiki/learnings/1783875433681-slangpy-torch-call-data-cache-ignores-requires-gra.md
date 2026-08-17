---
title: "slangpy torch call-data cache ignores requires_grad (autograd hook dropped)"
type: learning
topic: slang-compiler
source: learnings/1783875433681-slangpy-torch-call-data-cache-ignores-requires-gra.md
---

# slangpy torch call-data cache ignores requires_grad (autograd hook dropped)

## Symptom
A slangpy `[Differentiable]` function called FIRST with torch tensors that don't require grad permanently drops the autograd hook: every later `requires_grad=True` call of the same ndim/dtype returns `grad_fn=None` / `requires_grad=False`, and `loss.backward()` fails ("element 0 of tensors does not require grad"). Silent. (shader-slang/slangpy#1052)

## Root cause (verified in source)
The torch-tensor cache signature is `[Dn,Sm]` — **ndim + scalar_type ONLY**. `requires_grad` is read into the tensor-info struct but NEVER written to the cache key:
- native: `src/slangpy_torch/torch_bridge_impl.cpp:117-129` (`tensor_bridge_get_signature`); requires_grad read at line 78.
- fallback: `slangpy/torchintegration/bridge_fallback.py:88` (`get_signature`). Both identical; `SLANGPY_ALLOW_TORCH_FALLBACK=1` does not change it.

The autograd hook is gated at dispatch on the CACHED flag `call_data->is_torch_autograd()` (`src/slangpy_ext/utils/slangpyfunction.cpp:107` → `TorchAutoGradHook.apply`). That flag is frozen at Phase-2 build time by `detect_torch_tensors` (`slangpy/torchintegration/detection.py:57` → `slangpy/core/calldata.py:181-206`, sets `self.torch_autograd`). So a no-grad first build caches `torch_autograd=False` under `[Dn,Sm]`; same-shape grad calls hit it → hook bypassed. Explains the asymmetry: no-grad→grad broken, grad→grad OK, grad→no-grad OK.

NOTE: the autograd routing is the `torch_autograd`/`is_torch_autograd()` path — NOT the `BoundVariable.differentiable` flag (boundvariable.py:503-512), which keys off the slang type's `[Differentiable]` + marshall `has_derivative` (plain torch tensor → False).

## Fix direction
Append a grad bit to BOTH signature functions in lockstep (native + Python fallback, or the caches diverge) so grad/no-grad calls get distinct CallData. Frame as "grad-ness is CallData ROUTING identity, not kernel selection" — PR #935 (fixes #923) removed the dead `NativeTorchTensorDiffPair::read_signature` with rationale "grad config only affects dispatch binding, not which kernel compiles"; #1052 is the counterexample re the routing flag, so don't let the fix look like it re-litigates #935.

## Meta
The three per-arg-tensor signature bytes are the load-bearing detail. When a slangpy caching/differentiability bug shows order-dependence, check what actually goes into `tensor_bridge_get_signature` / `bridge_fallback.get_signature` vs what's merely read into the info struct.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783875433681-slangpy-torch-call-data-cache-ignores-requires-gra.md`_
