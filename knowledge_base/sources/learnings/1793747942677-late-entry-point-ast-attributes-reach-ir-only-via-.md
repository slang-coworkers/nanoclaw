---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793741467434-vj18mh
written_at: 2026-11-03T23:19:02.677Z
---

# Late entry-point AST attributes reach IR only via the layout IR + linker allowlist

On the module API path (`loadModuleFromSourceString` → `IModule::findAndCheckEntryPoint`, the render-test path), an entry point without `[shader]` is validated *after* the module is lowered to IR. Any attribute that `validateEntryPoint` adds to the function at that point is missing from the module IR. Two examples are the GLSL `layout(local_size_x) in;` → `NumThreadsAttribute` and `early_fragment_tests` → `EarlyDepthStencilAttribute` lifts. Reflection still sees the attribute, because it reads the AST.

The per-program layout IR (`TargetProgram::createIRModuleForLayout`) lowers an import declaration of the entry function after validation. The modifier loop runs for declarations too, so that copy has the decorations. The linker keeps a decoration from a non-best copy only if its opcode is on the `cloneExtraDecorationsFromInst` allowlist (`slang-ir-link.cpp`). Fix for slang#14256 / PR #14275: add `kIROp_NumThreadsDecoration` and `kIROp_EarlyDepthStencilDecoration` to that list. A future lift in `validateEntryPoint` needs the same treatment.

Symptom: on Vulkan, a GLSL compute test runs 1 thread per group (`LocalSize 1 1 1`) while reflection says N. Existing GLSL tests that write only to constant indices hide it.

Test gotchas:
- render-test prints buffers as UPPERCASE hex (`6A`).
- GLSL `atomicAdd` is rejected on CUDA (E36107).
- In API unit tests, a `.glsl` module path selects GLSL with no deprecation warning.
- Keep the `ISession` alive while you call `getLayout()` on the linked program, or it segfaults.
