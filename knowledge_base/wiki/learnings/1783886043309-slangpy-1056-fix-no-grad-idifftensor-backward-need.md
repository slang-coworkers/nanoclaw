---
title: "slangpy #1056 fix — no-grad IDiffTensor backward needs a bound scratch grad buffer on ALL backends"
type: learning
topic: slang-compiler
source: learnings/1783886043309-slangpy-1056-fix-no-grad-idifftensor-backward-need.md
---

# slangpy #1056 fix — no-grad IDiffTensor backward needs a bound scratch grad buffer on ALL backends

**Bug (#1056):** A `[Differentiable]` fn with ≥2 `IDiffTensor` params called via the torch integration aborts with `CUDA_ERROR_ILLEGAL_ADDRESS` in `.backward()` when only SOME inputs have `requires_grad=True`. Root cause: in backward every `IDiffTensor` binds as `DiffTensor` (keyed on `call_mode`, NOT per-tensor `requires_grad` — `tensorcommon.py:163-175`), so the kernel scatters into `_grad_out` unconditionally; but `NativeCallData::autograd_backward` (`slangpy.cpp:568-577`) set `pair->grad = nb::none()` for no-grad inputs → on CUDA `_grad_out` is a dangling raw device pointer the atomic scatter faults on.

**Fix (Approach A, 1 functional line):** in the `else` branch, bind `pair->grad = bridge.create_zeros_like_tensor(pair->primal)` (scratch, discarded) but still `input_grads.append(nb::none())` so torch reports no grad for that leaf. The two appends are independent, so no spurious grad leak; scratch is freed by the cleanup loop at `:604-605`. PR #1057.

**NON-OBVIOUS #1 — the bind must be UNCONDITIONAL, not CUDA-gated.** Intuition (and a codex advisory) says "the crash is CUDA-specific, so only allocate on CUDA." WRONG — empirically regresses Vulkan. `tensorcommon.py:153-161` guards `if grads_used and device != cuda:` and RAISES a `TypeError`/`ResolveException` at type-resolution when a diff tensor has no grad_out. So non-CUDA is the STRICT path (mandates the buffer) and CUDA is the permissive-but-crashes path. Both backends need the buffer, for opposite reasons.

**NON-OBVIOUS #2 — only the torch path is vulnerable; plain-Tensor/DiffTensorView are NOT.** Plain-Tensor native dispatch `SGL_CHECK(grad_out, "Missing required output gradients")` at `slangpytensor.cpp:269-270`, and `tensor.cpp:44` `SGL_THROW` for DiffTensorView — they fail LOUD on a missing grad buffer. Only the torch marshall (`slangpytorchtensor.cpp:397-407`) silently skips the write (`if (has_grad && ...)`), leaving the reserved region as garbage. So scope torch-only.

**Meta:** always empirically test a "narrow the scope" refinement before shipping it — reasoning-by-analogy about which backend "needs" a buffer was inverted. Reproduce the crash on the UNFIXED tree first (a CUDA illegal-access poisons the process, so run each matrix case in its own pytest process). Env quirk persists: driver 565.x needs torch cu126 wheel; build only `--target slangpy_ext` (full tree fails on gcc-12 example false-positive); incremental slangpy_ext rebuild ~28s, slangpy_torch needs no rebuild for a slangpy.cpp change.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783886043309-slangpy-1056-fix-no-grad-idifftensor-backward-need.md`_
