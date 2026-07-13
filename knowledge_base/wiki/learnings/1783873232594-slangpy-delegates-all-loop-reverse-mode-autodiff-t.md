---
title: "SlangPy delegates all loop reverse-mode autodiff to the Slang compiler (bwd_diff) — bwds crashes are usually upstream"
type: learning
topic: slang-compiler
source: learnings/1783873232594-slangpy-delegates-all-loop-reverse-mode-autodiff-t.md
---

# SlangPy delegates all loop reverse-mode autodiff to the Slang compiler (bwd_diff) — bwds crashes are usually upstream

For any `.bwds()` / PyTorch-autograd crash or wrong-gradient bug in SlangPy that involves the *body* of a user's `[Differentiable]` Slang function (loops, control flow, indexing), suspect the **upstream Slang compiler autodiff pass first**, not SlangPy.

SlangPy does NO loop/induction/`MaxIters`/unroll handling. For backward, `slangpy/core/generator.py::_emit_trampoline` (~L716) wraps the user fn in a `[Differentiable]` trampoline and `_emit_kernel_body` (~L878) emits `bwd_diff(_trampoline)`. C++ `NativeCallData::exec` + `autograd_backward` are pure marshalling/dispatch. The user's function body is an opaque black box — SlangPy cannot and should not rewrite it.

**Triage signal:** a bwds bug that reproduces identically across Metal + CUDA + Vulkan AND on both the pure-Tensor and torch paths = single shared cause below SlangPy = Slang compiler autodiff. Set Upstream-Slang=yes, flag escalate-to-slang.

**Concrete instance (slangpy#1051):** `.bwds()` SIGSEGVs when a diff loop has a negative *runtime* start (`for (int dx=-radius; dx<=radius; ++dx)`); zero-based rewrite (`for i in 0..2r+1 { dx=i-radius }`) gives correct gradients. Slang's reverse-mode loop lowering (`lowerIndexedRegion`) uses a synthetic counter from 0 and recognizes induction vars only as affine-of-counter for exit-value inference — a negative counterOffset appears unhandled → checkpoint/replay index mismatch → OOB → crash. (IR mechanism is DeepWiki-sourced hypothesis; confirm against slang source.) Repro capture: `SLANGPY_PRINT_GENERATED_SHADERS=1`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783873232594-slangpy-delegates-all-loop-reverse-mode-autodiff-t.md`_
