---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788383395268-uspvrx
written_at: 2026-09-02T21:19:08.543Z
---

# -cpu/host-callable and slangi/HostVM are distinct emit paths; PathInfo::type UB fix is HostVM-only

When triaging a "same bug on the CPP/`-cpu` target too" claim (slang#12891, spun off the aarch64 interpreter wrong-answer #12871 / draft fix #12879):

**The `-cpu`/host-callable target and the `slangi`/INTERPRET (HostVM) target do NOT share a module-serialization code path.** Dispatch is `CodeGenContext::_emitEntryPoints` switch (`source/slang/slang-code-gen.cpp:1114`):
- `CodeGenTarget::HostVM` → `emitHostVMCode` (`slang-emit.cpp:3700`), which does `new Module(linkage)` + `newModule->serialize()` at `slang-emit.cpp:3728-3732` → `encodeModuleDependencyPaths` → `Module::getFilePath` (`slang-module.cpp:298-302`) → `PathInfo::hasFoundPath()` reads `PathInfo::type`.
- `-cpu`/host-callable (Shader/HostHostCallable, executable, shared-lib) → `emitLLVMForEntryPoints` OR `emitWithDownstreamForEntryPoints` (`slang-code-gen.cpp:1198-1215`); C++ text via `CPPSourceEmitter`. **Never constructs a Module or calls serialize().**

Consequence: #12879's fix (`PathInfo::type = Type::Unknown`, `slang-source-loc.h`) — which cures the uninitialized read behind #12871's aarch64 `0 0` — is **exclusive to the HostVM byte-code path and does NOT touch the `-cpu` target.** A "CPP target also affected by the negative-sign bug" report is therefore NOT auto-resolved by #12879, even though both show the same symptom (arch-dependent wrong sign). If a CPP repro is confirmed it's most likely a *different* instance of the same UB class (uninitialized read / strict-aliasing) in the LLVM-JIT/downstream path, or an autodiff/witness-dispatch lowering bug.

Also: `kIROp_Neg` is emitted generically in the shared C-like emitter (`slang-emit-c-like.cpp:2688`, `"- "`), not CPP-specific, and a user `IFloat`/`IDifferentiable` `neg()` on `-(x*x)` lowers to a witness-table method CALL (not `kIROp_Neg`) — so there is no CPP-only negation site that could deterministically flip a sign. `CPPSourceEmitter` is shared with CUDA, so a deterministic C-like emit sign bug would also hit CUDA.

Triage lesson: for a "bug X also affects target Y" claim, verify at the code that Y actually exercises the same path before assuming a pending fix covers it — and don't dispatch a fixer for a target whose failure has no repro (x86_64 gave correct output).
