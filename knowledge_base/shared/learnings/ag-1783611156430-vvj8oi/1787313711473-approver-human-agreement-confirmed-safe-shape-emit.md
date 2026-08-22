---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787151517667-di53ps
written_at: 2026-08-21T12:01:51.473Z
---

# [approver/human-agreement] Confirmed-safe shape: emit an existing IR decoration on one more C-like backend, in a target-specific override, with a directional + downstream-compiler test

**Signal.** slang PR #12419 ("Emit `__noinline__` for CUDA device functions") — I decided
WOULD_APPROVE @ 6a466b8c964f; it merged 2026-08-21 with the merged head EQUAL to my decided
commit (no interval commits). merged ⇒ APPROVED-equivalent ⇒ my call confirmed. mode was
live_late (a human APPROVE predated the settled head).

**The safe shape (transferable, for Step-0 recall on similar PRs).** A change that:
1. makes one more backend *emit* an ALREADY-EXISTING IR decoration (here CUDA becoming the
   4th consumer of `IRNoInlineDecoration`, after SPIR-V/LLVM/HLSL) — i.e. it adds an output
   spelling, it does NOT add/gate/consume a new IR construct;
2. lives in a **target-specific emitter override** whose base is a no-op virtual not
   overridden by sibling emitters (here `CUDASourceEmitter::emitFunctionPreambleImpl`; base
   in c-like.h is `{}`, not overridden by `CPPSourceEmitter`) ⇒ provably no leak to the
   CPU/C++/other C-like targets;
3. touches only the emitter + a new test (no IR/inline-pass change);
4. ships a **directional** test (attribute present ⇒ specifier emitted; absent / wrong
   function-kind ⇒ not emitted) PLUS a downstream-compiler arm (here `-target ptx` through
   NVRTC) that fails on an invalid emitted sequence;
5. has **green CI on the affected target legs** at the head (here
   test-windows-{release,debug}-cl-x86_64-gpu-cuda / test-slang).

For this shape the failure class is CI-visible (build / the new test), so green CI on the
right legs is strong positive evidence. The CLAUDE.md **gate/flag probe does NOT apply** —
there is no new `RequiredLoweringPassSet` flag or gate whose failure direction is a silent
always-skip; the emit is unconditional given the pre-existing decoration.

**What still earned scrutiny (and cleared):** Devin's 2 🟡 test-robustness flags
(PTX/NVRTC-dependence, helper-inline fragility) — graded as nits, not OPEN_GAP, because they
concerned the test not the product and were covered+passing on the CUDA CI legs. The one
Informational (`__host__` branch also drops the request) was out-of-scope by design (NVRTC
rejects `__host__` in JIT mode). Neither shifted the verdict.

**Bottom line:** this "emit-an-existing-decoration-on-one-more-backend, target-scoped
override, tested both directions + downstream compiler, CI green on that target" shape is a
low-risk approve. Confirmed by merge on the exact decided commit.
