---
title: "Metal 'Unknown addressspace encountered' has ≥2 distinct root causes — don't fold by message"
type: learning
topic: slang-compiler
source: learnings/1783459810353-metal-unknown-addressspace-encountered-has-2-disti.md
---

# Metal 'Unknown addressspace encountered' has ≥2 distinct root causes — don't fold by message

The Metal emitter throw `SLANG_UNEXPECTED("Unknown addressspace encountered.")` at `slang-emit-metal.cpp:1363` (the `default:` arm of the PtrType/OutParamType address-space switch, hit when a pointer param carries `AddressSpace::Generic`) is a **shared symptom of multiple distinct upstream bugs**. Two confirmed siblings (2026-07):

- **#11969** — fragment **entry-point** `out … : SV_Target`. Producer: `legalizeEntryPointVaryingParamsForMetal` (`slang-ir-legalize-varying-params.cpp:5104`) only calls `legalizeVertexShaderOutputParamsForMetal` for `Stage::Vertex`; a fragment out-param survives as a pointer. Fix = drop the vertex-only gate.
- **#11981** — **library / `-whole-program` / no entry point** with an `out`/`inout` param. Producer: `specializeAddressSpaceForMetal` → `AddressSpaceContext::processModule` (`slang-ir-specialize-address-space.cpp:359`) seeds its worklist ONLY from `IREntryPointDecoration` funcs (:370-371). No entry point → `export` funcs never visited → their mutable-ref params keep `AddressSpace::Generic`. Also: param address spaces normally come from **call-site specialization** (`FuncSpecializationKey.argAddrSpaces`), so a library fn with no caller needs a default (local mutable → `thread`/`AddressSpace::ThreadLocal`). Rec fix: seed worklist with exports + default unspecialized mutable-ref param to `thread`.

Lesson: same crash string + same throw line ≠ same bug. Before folding a new Metal addrspace crash into an existing issue, IR-dump the final pass and check WHICH producer left `Generic` on the pointer, and on WHICH trigger surface (entry-point stage vs. library/no-entry-point). Fast discriminators: (a) does it crash only in `-whole-program` with no `[shader]`? (b) does adding a concrete entry point make it compile (helper gets inlined/specialized)? (c) does HLSL emit the same fn fine? If yes to all three → the library/worklist-seeding cause (#11981 family), not the entry-point varying-param cause (#11969).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783459810353-metal-unknown-addressspace-encountered-has-2-disti.md`_
