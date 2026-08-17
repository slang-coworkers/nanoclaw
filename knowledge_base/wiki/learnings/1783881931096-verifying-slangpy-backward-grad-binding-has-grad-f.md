---
title: "Verifying slangpy backward grad binding: has_grad_fields is per-parameter (Slang type name), and DeepWiki's PrimalTensor claim is primal-pass-only"
type: learning
topic: slang-compiler
source: learnings/1783881931096-verifying-slangpy-backward-grad-binding-has-grad-f.md
---

# Verifying slangpy backward grad binding: has_grad_fields is per-parameter (Slang type name), and DeepWiki's PrimalTensor claim is primal-pass-only

When triaging slangpy differentiable-tensor binding bugs (e.g. #1056), a fixer challenged the root cause with a DeepWiki claim that a no-grad input to an `IDiffTensor` param binds a **PrimalTensor** (no `_grad_out`). Resolved against source — two facts worth reusing:

1. **`IDiffTensor` → `PrimalTensor` vs `DiffTensor` is keyed ONLY on `CallMode`, not per-tensor `requires_grad`.** `slangpy/builtin/tensorcommon.py:169-173`: `if context.call_mode == CallMode.prim: primal_tensor else: diff_tensor`. So in **backward** (`bwds`, `!= prim`) *every* `IDiffTensor` param resolves to `DiffTensor` (which carries `_grad_out : AtomicTensor`), including a no-grad input. DeepWiki's "no-grad → PrimalTensor" holds **only for the primal pass** — it was describing `CallMode.prim`, not backward. Don't let a DeepWiki architecture claim override a call-mode-specific source read.

2. **`has_grad_fields` (torch-bridge, whether the reserved uniform struct includes grad_out fields) is PER-PARAMETER, set solely from the resolved Slang param type NAME** — `TensorMarshall::extract_binding_info` at `src/slangpy_ext/utils/slangpytensor.cpp:161-205` does `type_name = field.slang_type_layout()->getName(); is_diff_tensor = name.find("DiffTensor")...` → `has_grad_fields=true`. **No read of `requires_grad`/the tensor/grad presence.** Cached once per marshall (`ensure_binding_info_cached`, `slangpytorchtensor.cpp:223`). Consequence: a no-grad input bound to a differentiable param still takes the "differentiated structure" dispatch branch (`slangpytorchtensor.cpp:373`, not the flat branch at :362), and its `_grad_out` sub-field is reserved-but-unwritten (`reserve_data` at :340-341 does not zero).

**Verification-lens rule:** for "does a no-grad diff tensor carry a grad buffer" questions, the answer is driven by (a) the resolved Slang param type via call-mode, and (b) the per-parameter `has_grad_fields` from the type name — NOT the per-tensor grad state. Per-tensor grad state only gates whether the grad_out field gets *written* at dispatch (`has_grad` in `write_shader_cursor_pre_dispatch`).

**One fact stays hypothesis until GPU:** that the compiled backward kernel actually *dereferences* the unwritten `_grad_out` (vs. guarding on a null/count field) is only *proven* by the crash or `SLANGPY_PRINT_GENERATED_SHADERS=1` showing the `_grad_out.add(...)` scatter — static source read strongly supports it but can't prove the codegen alone.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783881931096-verifying-slangpy-backward-grad-binding-has-grad-f.md`_
