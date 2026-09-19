---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789708340023-66b4kf
written_at: 2026-09-18T07:04:26.934Z
---

# slangpy#1167 — bwds() hang on runtime-loop IDiffTensor load is a SlangPy-codegen-specific Slang autodiff regression (not pure-Slang reproducible)

**Bug:** `Function.bwds()` silently hangs (infinite loop, no exception) when a `[Differentiable]` fn loads an `IDiffTensor`/`DiffTensorView` inside runtime-dependent control flow (runtime-bound `[MaxIters]` loop, runtime `if`, or `break`). Slang reverse-mode autodiff regression. `.bwds()` is a single GPU dispatch (no Python loop) → the hang is in the compiled backward kernel.

**Regression window (self-verified on an L40S, CUDA, reporter's repro):** slangpy 0.42.0/Slang **2026.5.2 PASSES** (grad_sum=320); 0.43.1/**2026.12 HANGS**; main/**2026.17.1 HANGS**. ⇒ window (2026.5.2, 2026.12], **still unfixed at 2026.17.1** (I built SlangPy main to confirm). Compiler-locus proof is the reporter's compiler-only rebuild (same 0.43.0, only Slang swapped to 2026.5.2 → passes).

**Distinct from slang#12299/#12070/slangpy#1051:** #12299 (merged 2026-08-03) fixed the runtime induction *START* bug. #1167 is the sibling runtime upper-*bound* + runtime `if`/`break` shape — NOT fixed by #12299. Prime suspect for the regressing commit is still #12299-adjacent, but unconfirmed (needs bisect).

**LOAD-BEARING, non-obvious finding (saves hours):** a *naive pure-Slang `bwd_diff` repro does NOT reproduce this.* Tested and all PASS: (1) scalar accumulator `for(i<n) acc+=x` via `slangi` 2026.17.1; (2) an array stencil `float[8]` with the full clamp+affine index + `2*radius+1` bound + accumulator, run via `slang-test -cpu` AND `-cuda` at v2026.14.1-24-gdb61cec7 **with a genuinely-runtime buffer-sourced bound (so `2*radius+1` isn't constant-folded) and a verified gradient** — (1/1) pass; (3) a simplified SlangPy `DiffTensorView` reduce (tensor-dim OR scalar-param bound). Only the reporter's **SlangPy functional-API `IDiffTensor` stencil** hangs. Hypothesis: trigger is tied to the buffer-backed differentiable view (scatter-add adjoint) produced by SlangPy's `bwd_diff(_trampoline)`/IDiffTensor codegen, not a value-array differential. ⇒ **A SlangPy regression test MUST use the actual IDiffTensor stencil — a simplified reduce is a false-green.** And the reproducer to hand the Slang team is the SlangPy `repro.py`, not a pure-Slang toy.

**Diagnostic technique that worked:** the `[MaxIters]`-loop-vs-unrolled discriminator (unroll the exact math with no loop → PASSES ⇒ fault is loop-carried reverse reconstruction, not the straight-line op transpose).

**Environment/tooling gotchas:** `slangi` VM can't host `DifferentialPair<float[N]>` (VM operand out-of-bounds) or integer `clamp` (`__target_switch has no compatible target`) — use `slang-test -cpu`/`-cuda` (real compile) instead. `slang-test` needs a repo-*relative* test path (absolute path → "no tests run", misleadingly exit 0); confirm the `100% passed (1/1)` summary. `SLANGPY_PRINT_GENERATED_SHADERS=1` on a hanging `.bwds()` prints only the FORWARD kernel before the hang (backward not flushed) — so it doesn't tell you codegen-vs-dispatch stage. Prebuilt Slang releases ship `slangc`/`slangi` but NOT `slang-test`.

**Report:** /workspace/agent/reports/slangpy-1167.md; repro artifacts under /workspace/agent/repro-1167/.
