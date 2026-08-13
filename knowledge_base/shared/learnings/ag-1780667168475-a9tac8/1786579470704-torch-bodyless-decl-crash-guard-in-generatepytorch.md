---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786577973992-3awnwj
written_at: 2026-08-13T00:04:30.704Z
---

# Torch bodyless-decl crash: guard in generatePyTorchCppBinding misses the earlier lowerBuiltinTypes pass

Reviewing shader-slang/slang#12514 (fix bodyless `[TorchEntryPoint]` SIGSEGV on `-target torch`). Verdict APPROVE_WITH_NITS; the load-bearing finding needed empirical verification, not just a source trace.

**The gap (verified real, survives the fix).** The PR guards `generateCppBindingForFunc` with `if (!func->isDefinition())`. But on `-target torch` the emit pass order (slang-emit.cpp, `PyTorchCppBinding` case) is: `generateHostFunctionsForAutoBindCuda` → `lowerBuiltinTypesForKernelEntryPoints` (:1525) → `generatePyTorchCppBinding` (:1526, where the guard lives). `lowerBuiltinTypesForKernelEntryPoints` collects functions by `IRCudaKernelDecoration` (no body check) and derefs `func->getFirstBlock()->getParams()` at :1122 — so a bodyless `[CudaKernel]` (incl. `[TorchEntryPoint]`+`[CudaKernel]`, and `[CudaKernel]`-ONLY) still SIGSEGVs *before* the guard runs. `generateCppBindingForFunc` has exactly one caller (:1290) fed by a `IRTorchEntryPointDecoration`-ONLY worklist, so a `[CudaKernel]`-only func structurally never reaches the guard. `checkCudaKernelAttribute` (slang-check-decl.cpp) requires no body, so these decls survive the frontend.

**How I proved it (the discriminator).** The prebuilt `build/Release/bin/slangc` is master (pre-guard), so it crashes on everything — a plain crash is not evidence the *guard* is bypassed. The discriminating control: `[CudaKernel]`-only bodyless crashes on **both** `-target torch` AND `-target cuda`. On `-target cuda`, `generatePyTorchCppBinding` is never in the pass list at all, yet it still SIGSEGVs → the crash is provably in the shared earlier pass, not the guarded function. That single cross-target control is what upgraded "plausible from the trace" to "verified". Root-cause fix belongs in the semantic checker (reject bodyless kernel attrs), closing all emit sites at once.

**Two Devin claims to refute on this class of PR:**
1. Devin flagged as a *Bug* "new compiler error introduced without the required documentation update (Repo rule)". There is NO such repo rule (grep of docs/diagnostics.md, diagnostic-guidelines.md, CONTRIBUTING, .github = empty). The diagnostics catalog under `docs/generated/tests/.../diagnostics-catalog/` is AUTO-GENERATED ("Do not edit by hand") and sibling torch codes E55101/E55102/E55200 are all listed UNCOVERED — nobody hand-documents a new code. At most a housekeeping regen, never a blocking bug.
2. Devin said the test should use `DIAGNOSTIC_TEST` "like sibling torch reject tests". There are NO dedicated torch-reject sibling tests (E55101/E55102 UNCOVERED; grep empty). The real torch siblings (`tests/autodiff/autopybind-*.slang`) use `//TEST:SIMPLE(filecheck=TORCH): -target torch -line-directive-mode none` — the SAME SIMPLE directive this PR uses, which also pins `result code = -1`. DIAGNOSTIC_TEST is idiomatic per CLAUDE.md but the PR's choice matches torch-family convention; keep as a low nit, not a defect.

Reusable: when a fix adds a guard to ONE emit pass for a "bodyless decl derefs getFirstBlock()" crash, always check the pass ORDER (an earlier pass on the same target may deref first) and the DECORATION the crashing pass keys on (a different decoration = the guarded worklist never sees it). Verify with a cross-target control that disables the guarded pass entirely.
