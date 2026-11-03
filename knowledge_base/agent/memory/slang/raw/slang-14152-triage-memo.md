---
type: triage
title: "Triage #14152 — inout arg into interface-typed storage mixes two existential layouts"
description: typeflow specialize retypes get_field_addr / buffer-element addresses to Ptr(TaggedUnion) while the storage stays the legacy {uint2,uint2,AnyValueN} existential; specializeCall passes Out/InOut pointers unchanged.
resource: /workspace/agent/scratch-14152/
---
# Triage: shader-slang/slang#14152 — Dynamic dispatch: interface-typed field of a `uniform` struct passed to `inout` mixes two existential layouts
Date: 2026-11-02 | bug | medium | P2 | IR (type-flow dynamic-dispatch specialization) | Duplicate: no
Reporter: albertrodriguezclo (external), filed 2026-11-02T10:04:23Z. **R6 hold until 2026-11-06T10:04:23Z** (no comment/label/Type/PR naming #14152).

## What's broken
`takeRef(inout IFoo f)` called with `p.foo` (`uniform Params p { IFoo foo; float scale; }`,
`[anyValueSize(16)]`, `-conformance ImplA:IFoo=0 -conformance ImplB:IFoo=1`). The field keeps the
legacy existential layout `{uint2 rtti; uint2 wtId; AnyValue16}`; the callee param is specialized to
the compact tagged union `{uint tag; AnyValue4}`; the caller passes the field address unchanged.
slangc exits 0 for text targets; every downstream compiler rejects.

## Repro (FACT, master 6815ed82d, Release build from 2026-11-01 — `-version` string is stale configure-time `3649fb982`, no source newer than the lib)
Files: `/workspace/agent/scratch-14152/` (`ifacefield.slang` = reporter repro; `run.sh <variant>` runs dxil + spirv-val).
```
C='-entry computeMain -stage compute -conformance ImplA:IFoo=0 -conformance ImplB:IFoo=1'
slangc ifacefield.slang -target dxil -profile cs_6_5 $C        # dxc: no known conversion from 'Tuple_0' to 'Tuple_1'
SLANG_RUN_SPIRV_VALIDATION=1 slangc ifacefield.slang -target spirv $C   # OpAccessChain result type mismatch, E99999
slangc ifacefield.slang -target spirv -emit-spirv-via-glsl $C  # glslang: no matching overloaded function
slangc ifacefield.slang -target ptx $C                          # nvrtc: "Tuple_1 *" incompatible with "Tuple_0 *"
slangc ifacefield.slang -target metal|hlsl|glsl|wgsl|cuda $C    # exit 0, mistyped output (WGSL: var Tuple_0 = <Tuple_1 field>)
```
Metal not compiled locally (no xcrun); MSL text shows the same `takeRef_0(&(&_S17)->foo_0)` vs `Tuple_0 thread*` as reported.
GPU run not applicable: SPIR-V fails validation before any dispatch.

### Variant table (FACT; dxc = -target dxil cs_6_5; spv = spirv-val)
| Variant | dxc | spv |
|---|---|---|
| by-value `p.foo` (uniform) | OK | OK |
| reporter: inout `p.foo` | FAIL | FAIL |
| local `IFoo x = p.foo; takeRef(x)` | OK | OK |
| `out IFoo` into a local | OK | OK |
| `out` into local struct field `q.foo` | FAIL | FAIL |
| inout `RWStructuredBuffer<IFoo>[0]` | FAIL | FAIL |
| inout `RWStructuredBuffer<Params>[0].foo` | FAIL | slangc HANGS (>40 s, inside SPIR-V emit) |
| local `Params q = p; takeRef(q.foo)` | FAIL | FAIL |
| **by-value** `takeVal(pBuf[0].foo)` (`RWStructuredBuffer<Params>`) | FAIL | FAIL |
| `uniform IFoo` entry param, inout | OK | OK |
Every failure = an address into storage whose type the pass cannot retype (struct field without
`fieldInfo`, or a buffer element). The by-value `pBuf[0].foo` row shows the defect is the address
path, not inout per se (it reads through get_field_addr + load).

## Codebase digest (all `source/slang/slang-ir-typeflow-specialize.cpp` unless noted; read at 6815ed82d)
- First bad pass: `specializeModule` → `specializeDynamicInsts` (slang-ir-specialize.cpp:1891). Before:
  `%58 : Ptr(IFoo) = get_field_addr(%localParams, %foo); call takeRef(%58)`. After:
  `%68 : Ptr(TaggedUnion(..)) = get_field_addr(...)` while `struct Params { %foo : IFoo }` is unchanged.
  Later `lowerExistentials` → field `{uint2,uint2,AnyValue16}`; `lowerTaggedUnionTypes` → ptr `{uint,AnyValue4}`.
- `analyzeFieldAddress` :2862-2893 — when the field has no `fieldInfo`, falls back to
  `Ptr(TaggedUnion(all tables))` (added by cc649df53 / PR #10856 for #10261).
- FuncToCall edge :2232-2262 — Out/BorrowInOut param info is merged back onto the argument via `updateInfoForMerge(arg)`.
- `specializeInst` has no FieldAddress / (RW)StructuredBufferGetElementPtr case → default `replaceType` (:5918-5920) retypes the address;
  `specializeStructType` (:5262) retypes only fields with `fieldInfo` → pointer/pointee disagree.
- Existing bridges (precedent): `specializeLoad` :7781-7815 and `specializeStore` :~7985-8008 emit
  `CastInterfaceToTaggedUnionPtr` and keep the base `Ptr(Interface)`; `specializeFieldExtract`
  :7844-7894 (74c724aec, #11667) bridges `get_field` via temp var + cast. **`get_field_addr` has no bridge.**
- `specializeCall` :7085-7115 — only `In` args get `upcastSet`; `Out`/`BorrowInOut`/`BorrowIn`/`Ref`
  pass the pointer unchanged ("sets must match").
- `lowerCastInterfaceToTaggedUnionPtr` (slang-ir-lower-dynamic-dispatch-insts.cpp:1304-1446) rewrites
  only Load/Store/(RW)StructuredBufferLoad users (`convertToTaggedUnion`/`convertToInterface` :1216-1302);
  any other user → `SLANG_UNEXPECTED` :1441. `maybeUnpackArg` (same file :45-123) has temp+pack only for out.

## Candidate approaches
### A: Address-side bridge + call-site copy-in/copy-out in the type-flow pass (RECOMMENDED)
- Where: new `specializeFieldAddress` (and the buffer `GetElementPtr` ops) beside `specializeFieldExtract` :7844;
  `specializeCall` :7085-7115; possibly the FuncToCall merge :2232-2262.
- Delta: an address into non-retypable interface storage stays `Ptr(IFoo)` (invariant: retype an address
  only when its base location is retyped). At a call whose Out/BorrowInOut/BorrowIn param is
  `Ptr(TaggedUnion)` and whose arg is `Ptr(Interface)`: temp `Ptr(TaggedUnion)`; copy-in (inout/borrow-in) via
  `load(CastInterfaceToTaggedUnionPtr(arg))`; call with temp; copy-out (out/inout) via
  `store(CastInterfaceToTaggedUnionPtr(arg), load(temp))`. Loads/stores through the address use the
  existing specializeLoad/Store bridge, which fixes the by-value `pBuf[0].foo` row too.
- Tradeoffs: reuses the existing cast lowering (only Load/Store users — no new lowering); host-visible layout
  untouched; copy cost only at storage-backed call sites. Matches the reporter's option 1.
- Risk: fixpoint re-bridging (needs an `isBridged…` guard like `isBridgedInterfaceFieldExtract` :7830); `Ref` (`__ref`) semantics — copy breaks
  aliasing, so `Ref` should be diagnosed or proven unreachable, not silently copied; must not disturb
  `fieldInfo`-backed fields (MakeStruct-built locals) where retyping is correct.

### B: Specialize the callee for the storage layout
- Where: param-info propagation (:2125-2150 analysis, :2232 merge) + callee cloning.
- Delta: when a call site passes a non-retypable `Ptr(Interface)`, keep that param (or a clone) as `Ptr(IFoo)` and dispatch on the legacy existential.
- Tradeoffs: no copies, preserves aliasing (would cover `Ref`); but needs per-layout clones or de-specializes
  every caller, mixes two dispatch paths in one function, larger blast radius in the fixpoint. Reporter's option 2.
- Risk: high — perturbs specialization of all callers; harder to keep the "sets must match" invariant.

### C: Give the struct field the tagged-union layout (`fieldInfo` for `Params.foo`)
- Ruled out: `Params` is the cbuffer/structured-buffer layout the host fills via reflection
  (`{rtti, wt, AnyValueN}`; e.g. tests/language-feature/dynamic-dispatch/constantbuffer-struct-interface-field.slang
  `TEST_INPUT:set gParamsA = new{ foo: new ImplA{...} }`). Changing it is an ABI/layout change.

### D: Front-end temp for interface-typed inout args (slang-lower-to-ir.cpp `addArg`)
- Rejected: wrong layer (front end has no layout knowledge), masks the IR defect, and does not fix the by-value
  `pBuf[0].foo` address+load row.

## Recommended path (solution brief, ≤15 lines)
- **Hypothesis:** type-flow specialization retypes `get_field_addr` / buffer element addresses into
  interface-typed storage to `Ptr(TaggedUnion)` without retyping the storage, and `specializeCall` forwards
  Out/InOut pointers unchanged, so two existential layouts meet at the call.
- **Suspected files:** slang-ir-typeflow-specialize.cpp:2862 (analyzeFieldAddress fallback), :7085-7115
  (specializeCall), :7844 (specializeFieldExtract = bridge precedent), :2232 (FuncToCall merge);
  slang-ir-lower-dynamic-dispatch-insts.cpp:1304 (cast lowering, Load/Store only).
- **Repro:** `/workspace/agent/scratch-14152/run.sh <variant>` (dxil + spirv-val); reporter file `ifacefield.slang`.
- **Accept when:** every FAIL row above compiles through dxc, spirv-val, glslang and nvrtc (no hang on
  `vd_rwsb_params` SPIR-V); a runnable `COMPARE_COMPUTE` test modeled on
  `constantbuffer-struct-interface-field.slang` (inout + out through a cbuffer/RWStructuredBuffer field, ImplA and ImplB)
  passes on -cpu, -vk, -cuda (L40S); `diagnose-entry-point-interface-in-struct.slang` SPIRV/WGSL lanes re-enabled;
  existing dynamic-dispatch tests stay green.
- **Recommended:** A — producer-side invariant ("retype an address only with its base") plus call-site
  copy-in/out through the existing `CastInterfaceToTaggedUnionPtr` Load/Store lowering; no layout change.

## Side find (from parent's lead) — same root cause, no separate issue
- Test `tests/language-feature/dynamic-dispatch/diagnose-entry-point-interface-in-struct.slang`: created 715694436 (#10260);
  cc649df53 (PR #10856, for #10261) added the HLSL/GLSL/MTL lanes, `ImplB`, the `takeRef(inout IFoo)` call and the
  "storage-to-logical assertion" comment (PR notes name a `resultType` assert); 76d3f1416 (#12924) changed HLSL CHECKs only.
- The `resultType` assertion **no longer reproduces** (Release and Debug). The SPIR-V lane now fails spirv-val
  (OpAccessChain result type mismatch); WGSL exits 0 with mistyped output. The enabled HLSL/GLSL/MTL lanes pass
  only because FileCheck matches strings — dxc/glslang reject their output. Control: removing the `takeRef` line → all valid.
- Hypothesis (unverified): the old assert was `SLANG_RELEASE_ASSERT(resultType)` in `IRBuilder::emitFieldExtract/emitFieldAddress`
  (slang-ir.cpp:5779/:5843) via slang-ir-lower-buffer-element-type.cpp.
- The `vd_rwsb_params` SPIR-V hang is likely a consequence of the ill-typed IR; not root-caused. If it survives the fix, file
  separately (must not reference #14152 before 11-06).

## Classification notes
- Regression: no indicator (reporter does not say it used to work); the inout lane was miscompiling since PR #10856 added it. Do not label.
- At R6 release: Type=Bug (blank today), `reproduced` (reproduced locally on top-of-tree via dxc/spirv-val/glslang/nvrtc).
- Siblings #14154 / #14156 (same reporter, Metal) are separate chains.

## Sources
- DeepWiki: (1) typeflow param specialization: only `In` args are upcast; pointer params "sets must match"; loads from
  interface-typed pointers bridged via CastInterfaceToTaggedUnionPtr. (2) that cast's lowering rewrites Load/Store users only.
- Related issues (not dups): #10261 (closed, PR #10856 — by-value crash), #9674 (closed, internal/external existential header sizes),
  #10222 (open, tagged-union layout vs bit_cast), #10892 (open, bare `uniform IFoo` crash in collect-global-uniforms),
  #9906/#7788 (closed, `__ref` interface params / sub-to-super cast to out), #7350 (open, WGSL createDynamicObject).
- Shared learnings: wiki concept slang-compiler-type-flow-and-gate-discipline.md (PR #12935: fix at producer; "emission succeeded" ≠ valid).
