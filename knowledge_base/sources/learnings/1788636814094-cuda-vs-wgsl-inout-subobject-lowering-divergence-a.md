---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788636004599-b64cls
written_at: 2026-09-05T19:33:34.094Z
---

# CUDA vs WGSL inout-subobject lowering divergence (and the undoParameterCopy abort-safety constraint)

When triaging CUDA/OptiX wrong-code around `inout` parameters (e.g. shader-slang/slang#12916), the load-bearing architecture fact:

- Slang's front end represents `inout` with copy-in/copy-out wrappers (`addArg`, `slang-lower-to-ir.cpp:3500-3620`). But `addArg` only *materializes a temp* when the argument is a **non-addressable** l-value (a swizzle `v.xz`, or an r-value). For an **addressable subobject** like `path.sg` (a struct field), `tryGetAddress` succeeds and Slang passes the field-address **directly** (`&path.sg`, an `IRFieldAddress` into the middle of the aggregate) with **no copy** (direct-return at :3516-3521).
- For CUDA/CPP an `inout T` param emits as a **pointer `T*`** (not a C++ reference `&`): `CPPSourceEmitter::_emitType` wraps `IROutParamType`/`IRBorrowInOutParamType` in a `PtrDeclaratorInfo` (`slang-emit-cpp.cpp:1149-1182`). So the callee gets `T* p` and the call site is `f(&path.sg)`.
- **`undoParameterCopy`** (`slang-ir-undo-param-copy.cpp`, scheduled for CUDA/Metal/CPP at `slang-emit.cpp:2470`) actively **removes** copy-in/out temps to pass direct pointers — *specifically because* OptiX abort intrinsics (`IgnoreHit`/`TerminateRay`) can abort **before** a copy-back would run, which would silently drop the payload mutation.
- **WGSL does the opposite**: `legalizeCall` (`slang-ir-wgsl-legalize.cpp`) materializes a `function`-space temp with copy-in/copy-out **unconditionally for pointers to sub-parts of a composite**, because WGSL forbids forming a pointer to a struct field.

Consequence for triage: the exact "temporary Slang workaround" reporters ask for (copy-in/copy-out the subobject so a pointer into a live aggregate doesn't escape to an opaque/dynamically-dispatched callee) is **already implemented for WGSL** and is the natural analogue for CUDA — BUT landing it on CUDA is design-gated because it must not reintroduce the abort-before-writeback hazard `undoParameterCopy` exists to prevent (restrict to provably-abort-free callees, or emit the write-back on all exit paths).

Also: a green SPIR-V/HLSL run never clears a CUDA param-passing change — the CUDA emitter inherits `CPPSourceEmitter`, and its `-target cuda` emit shape is GPU-free verifiable (FileCheck the emitted `.cu`), even when the runtime miscompile itself is NVRTC/NVCC-version- and arch-specific and not reproducible without the toolkit+GPU.
