---
title: "Metal 'Unknown addressspace' on export out/inout params: trigger is export-linkage, not missing entry point"
type: learning
topic: slang-compiler
source: learnings/1783460634599-metal-unknown-addressspace-on-export-out-inout-par.md
---

# Metal 'Unknown addressspace' on export out/inout params: trigger is export-linkage, not missing entry point

**Context:** shader-slang/slang#11981 triage (HEAD 33f9ed0ce). Metal crashes with `InternalError: Unknown addressspace encountered.` on a function with an `out`/`inout` (mutable-reference) parameter.

**The non-obvious part — the trigger is narrower than "library / no entry point":**
The auto-filed report (and its first workaround note) said it crashes only when there's no `[shader]` entry point, and suggested "add an entry point" as a workaround. That is WRONG. Verified by 6 controls with `build/Debug/bin/slangc -target metal` (text, no GPU):
- `export` helper with `out` param → **CRASH** whether or not a `[shader]` entry point is present, and whether or not `-whole-program` is passed.
- **non-export** helper → always emits fine (it's inlined/specialized from its caller, or dead-code-eliminated).
So the real discriminator is **`export`/public linkage on a function with a mutable-reference param.** The "add an entry point" workaround does not help; the effective workaround is to drop `export` (so it inlines/specializes) or target WGSL/GLSL.

**Root cause (two sites, both confirmed by direct read):**
1. Producer: `AddressSpaceContext::processModule` (`slang-ir-specialize-address-space.cpp:359-373`) seeds its worklist ONLY from `IREntryPointDecoration` funcs (`:370-371`) — never `HLSLExport`/`Public`. Ordinary funcs otherwise get param address spaces by **call-site specialization** (`processFunction` kIROp_Call arm `:231-283` → `specializeFunc` `:87-123`; see `tests/metal/out-param.slang` cloning into `int thread*`/`int threadgroup*`). An `export` library boundary has no caller to specialize from → the pointer param keeps `AddressSpace::Generic` (`=0x7fffffff`, `slang-type-system-shared.h:122`).
2. Symptom: `MetalSourceEmitter::emitSimpleTypeImpl` (`slang-emit-metal.cpp:1339-1365`) switches on the pointer's address space with no `case` for `Generic` → `default: SLANG_UNEXPECTED` (`:1362`).

**Cross-backend contrast that scopes the fix layer:** WGSL and GLSL emit the SAME repro cleanly — and WGSL uses the same shared `specializeAddressSpace` pass (`specializeAddressSpaceForWGSL`). So the worklist-seeding gap is shared, but only Metal *crashes*, because only the Metal emitter treats an unspecialized `Generic` pointer as fatal. => the principled fix is producer-side (seed exports + default unspecialized library-boundary mutable-ref params to `ThreadLocal`/`thread`, matching the Metal assigner's existing `Var→ThreadLocal` at `slang-ir-metal-legalize.cpp:127-152`), NOT an emitter fallback `case` (which would mask the unspecialized IR).

**Sibling, not dup:** #11969 shares the same emitter symptom but a different producer — the vertex-only stage gate in `legalizeEntryPointVaryingParamsForMetal` (`slang-ir-legalize-varying-params.cpp`). Entry-point varying-param path vs. library-boundary ordinary-param path; neither fix subsumes the other.

**Method note:** when a bot-filed issue states a "does not crash when X" observation + a workaround, run the crossed controls (X present/absent × other flags) before trusting it — the discriminator was off by one dimension here.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783460634599-metal-unknown-addressspace-on-export-out-inout-par.md`_
