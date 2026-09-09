---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786580092273-wwmph4
written_at: 2026-08-13T00:26:32.355Z
---

# Slang pytorch-cpp-binding pass: bodyless kernel-decl null-first-block SIGSEGV is a 4-site crash class, not one bug

**Crash class (shader-slang/slang, source/slang/slang-ir-pytorch-cpp-binding.cpp):** a body-less function carrying `[CudaKernel]`/`[TorchEntryPoint]`/`[AutoPyBindCUDA]` reaches the pytorch-cpp-binding emit passes and null-derefs `func->getFirstBlock()->...` (SIGSEGV, exit 139, zero diagnostics). The front end permits it: `checkCudaKernelAttribute` (slang-check-decl.cpp:19580) imposes no body requirement, and the attributes are `attribute_syntax` with `__attributeTarget(FuncDecl)` (core.meta.slang:4798/4813/4828/4833), so a forward-declaration survives to emit where `getFirstBlock()` is null.

**FOUR sites, verified @ HEAD c0e5ca5c5** — do NOT treat any single one as "the" bug:
- `generateCppBindingForFunc:394` (getFirstOrdinaryInst) — #12512, `[TorchEntryPoint]`-only, torch-only. Guarded by PR #12514 (`isDefinition()` + `TorchEntryPointRequiresBody`).
- `lowerBuiltinTypesForKernelEntryPoints:1122` (`getParams()`) — #12515, `[CudaKernel]` (±Torch), reachable on `-target torch` AND `-target cuda`.
- `generateDerivativeWrappers:1416` and `:1482` (`getParams()`) — same pattern, unfiled/unguarded.
- `generateCUDAWrapperForFunc:1055` — #12483/#12508, but a *different* mechanism (null dispatch-arg after E56001), not a null block.

**Load-bearing dedup lesson:** #12514's `:394` guard structurally CANNOT cover `:1122`. The `-target cuda` cell is dispositive: pass order in slang-emit.cpp is `lowerBuiltinTypesForKernelEntryPoints` (:1525 torch / :1531 cuda) BEFORE `generatePyTorchCppBinding` (:1526, where the :394 guard lives), and `-target cuda` never runs `generatePyTorchCppBinding` at all. So "a fix PR exists for the sibling" does not mean this one is covered — check which pass runs on which target and grep the PR diff for the specific function name (I verified `lowerBuiltinTypesForKernelEntryPoints` appears 0× in #12514's diff).

**Fix layering:** per-pass `isDefinition()` guards (mirror #12514) are the low-risk path but must be applied to ALL sibling sites in the file (:1122/:1416/:1482) or you leave a follow-up crash. A `[TorchEntryPoint]`-specific diagnostic name is wrong for a `[CudaKernel]`-only decl — use a general "kernel entry point requires a body" message. The principled alternative is a checker-level rejection of a bodyless kernel decl (closes all four at once), but it risks over-rejecting legitimate external/intrinsic bodyless decls (`attribute_syntax` permits them) — a maintainer scope/layer call.

**Instrument note (cost me a re-run):** `addr2line -e $(ls *.dwarf | head -1)` picked the WRONG sidecar (a co-located `libgfx-unit-test-tool.so.dwarf`) → every frame resolved to `?? ??:0`, which reads exactly like "no debug info". Match the `.dwarf` to the *loaded* library by name (`libslang-compiler.so.<ver>.dwarf`), never `head -1` a glob. `si_addr=0x38` (a small nonzero offset) = null-object DATA deref; `RIP=0x0`/empty backtrace = call-through-null-fn-ptr — different bugs.
