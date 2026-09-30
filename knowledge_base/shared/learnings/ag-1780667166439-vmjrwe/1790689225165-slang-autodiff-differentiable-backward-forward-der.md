---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-29T13:40:25.165Z
---

# Slang autodiff: [Differentiable] + [Backward|Forward]Derivative creates two conformances; the default wins through interface calls (#13301)

Root cause of #13301, verified with IR dumps on master 68563d2f3:
- `checkDifferentiableCallableCommon` (slang-check-decl.cpp:15624) runs at SignatureChecked and unconditionally synthesizes default `extension f : IBackwardDifferentiable<f>` / `IForwardDifferentiable<f>` conformances (auto ops `BackwardDifferentiatePrimal`, `BackwardRemat`, `ForwardDifferentiate`).
- `translate{Fwd,Bwd}DerivativeAttributeToAD2` runs later at ReadyForLookup and adds a second conformance for the user derivative. `extendContainerDecl` always creates a new extension.
- Both conformances lower to the same witness symbol (`getMangledNameForConformanceWitness`). The merged table keeps the default's entries (first wins), so calls through an interface requirement run the auto-derivative. You can spot it in `-dump-ir-before specializeModule`: one witness table carrying two `[export]`s.
- Direct concrete calls are correct only because caller associations (Annotation kinds 4/5/7/9) point at the custom members. A generic caller's `lookupWitness` folds to the concrete method after `specializeModule`, attaching a second `apply` annotation, and the default then wins there too.

Fix for the attribute-on-primal spelling: skip the default when the decl carries its own [ForwardDerivative]/[BackwardDerivative]. `[*DerivativeOf]` can't be fixed at header time, because its primal resolution looks up the default members; it needs a single extension whose members are bound before conformances.

Testing tips:
- One test file can cover several rows with `//TEST:COMPARE_COMPUTE(filecheck-buffer=ROW):-cpu -shaderobj -output-using-type -Xslang... -DROW -X.`.
- Anchor values with `{{^}}10.0`, since `10.0` otherwise matches `110.0`.
- A custom derivative that is deliberately wrong (d=10 vs 3) plus a call counter shows which derivative ran.

Build tips for a lean worktree build:
- slang-test depends on slangd, so SLANG_ENABLE_SLANGD=OFF breaks configure.
- Build `slang-numerics-modules` / `slang-functional-module` / `slang-neural-module` / `slang-workgraph-module` / `slang-glsl-module` before running the full suite; otherwise about 60 tests fail with "cannot open file slang/numerics/...".
- `tests/dispatcher/smoke.slang` needs the `slang` dispatcher binary.
