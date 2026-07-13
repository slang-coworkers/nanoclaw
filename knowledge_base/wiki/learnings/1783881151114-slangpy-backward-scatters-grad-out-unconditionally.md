---
title: "slangpy backward scatters _grad_out unconditionally but binds it only for requires_grad inputs (CUDA illegal address, #1056)"
type: learning
topic: slang-compiler
source: learnings/1783881151114-slangpy-backward-scatters-grad-out-unconditionally.md
---

# slangpy backward scatters _grad_out unconditionally but binds it only for requires_grad inputs (CUDA illegal address, #1056)

**shader-slang/slangpy#1056** — a `[Differentiable]` fn with ≥2 `IDiffTensor<float,2>` params, called through the torch integration, aborts the process with `CUDA_ERROR_ILLEGAL_ADDRESS` in `.backward()` when some-but-not-all inputs have `requires_grad=True`. Matrix: yes/yes OK; yes/no & no/yes abort.

**Root cause (confirmed against source):** two layers disagree on when a grad buffer exists.
- The compiled backward kernel scatters `_grad_out` **unconditionally** for *every* `IDiffTensor` param — `DiffTensor` always carries `_grad_out : AtomicTensor` and the `[BackwardDerivative]` of `.load()` calls `_grad_out.add(idx, grad)` with no per-arg guard (`slangpy/slang/difftensor.slang:130-147, 373-378`). On CUDA the atomic target is a **raw `T*`** (`slangpy/slang/atomics.slang:106-109`, `#ifdef __TARGET_CUDA__ AtomicBufferType = T*`).
- But dispatch binds a grad buffer **only** for `requires_grad=True` inputs: `NativeCallData::autograd_backward` sets `pair->grad = nb::none()` for a no-grad input (`src/slangpy_ext/utils/slangpy.cpp:568-577`), so in the torch-bridge marshall `has_grad = !grad_value.is_none()` is false and the grad_out sub-fields are left **unwritten** in the reserved param-struct region (`src/slangpy_ext/utils/slangpytorchtensor.cpp:297-301, 340-341, 397-407`).
- Net: the no-grad param's `_grad_out` is a **dangling/zero device pointer**; the unconditional atomic scatter faults.

**Why the crash is a hard abort, not a Python error:** the pre-dispatch guard that would raise `TypeError` for a diff tensor lacking a grad buffer is **CUDA-gated OFF** — `if grads_used and context.device.desc.type != DeviceType.cuda:` at `slangpy/builtin/tensorcommon.py:153`. (That guard is on the plain-`Tensor` path; the torch-bridge path has no equivalent guard at all.)

**Relationship to #1052 / PR #1054 — verified DISTINCT:** #1052 is a *silent* autograd-hook drop from a mis-keyed call-data cache (no crash). PR #1054 is *routing-only*: it appends a per-tensor grad bit to the cache signature `[Dn,Sm]→[Dn,Sm,Gk]`; kernel + dispatch binding are unchanged. #1056 crashes on the **first call in a fresh process** → no cache entry to mis-key → not fixed by #1054. General rule: a "grad" bug that crashes ≠ a "grad" bug that silently drops the hook; the crash lives in dispatch-time buffer **binding**, not cache selection.

**Fix direction:** bind a valid zeroed scratch `_grad_out` buffer for no-grad `IDiffTensor` inputs at backward dispatch (matches the user's own `t.detach().requires_grad_(True)` workaround, done internally) while still reporting `None` back to torch for that leaf. Alternative: emit a per-param grad-bound flag and guard the kernel scatter (touches shared codegen/ABI).

**Test:** cover all 3 matrix cases on CUDA and use the `torch_bridge_mode` fixture (native + Python fallback bridge must stay identical) per the #1052 verification learning.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783881151114-slangpy-backward-scatters-grad-out-unconditionally.md`_
