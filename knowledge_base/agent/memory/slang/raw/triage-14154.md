---
type: source
description: "Metal read-only StructuredBuffer/ByteAddressBuffer emitted as writable `T device*` → 'writable resources in non-void vertex function'; Bug/low/P2; fix = const on RO buffer types (emit-metal:1537-1552) + Read access on RO element-ptr temps (else invalid MSL); R6-held to 2026-11-06T10:04:27Z"
okf_synth: exempt
---
# Triage: shader-slang/slang#14154 — Metal: read-only StructuredBuffer / ByteAddressBuffer emitted as writable `device T*`
Date: 2026-11-02 | Bug | low | P2 | target-emit (Metal) | Duplicate: no (related #6427, #14141)
Reporter: albertrodriguezclo (CONTRIBUTOR, human). R6 hold until 2026-11-06T10:04:27Z (main's timer r6-release-14154-33ea).

## What's broken
On `-target metal`, `StructuredBuffer<T>` → `T device*` and `ByteAddressBuffer` → `uint32_t device*`, the same text as
the RW forms. Apple `metal` then warns "writable resources in non-void vertex function" once per read-only buffer that a
non-void vertex function receives. Expected: `const device T*` (or the equivalent `const T device*`). The reporter says a
hand-edited `const device` version compiles clean at metal3.0/3.1. That is the reporter's claim; we have no Apple toolchain to check it.

## Repro (FACT, master 6815ed82d, Release build newer than every source file; its version string 3649fb982 is a stale configure-time header)
- `slangc sbvert.slang -target metal -line-directive-mode none` →
  `[[vertex]] main_Result_0 main_0(uint vid_0 [[vertex_id]], float device* scales_1 [[buffer(0)]], uint32_t device* raw_1 [[buffer(1)]])`
  Byte-identical to the issue's "Actual" line. The `KernelContext_0` fields are also `float device*` / `uint32_t device*`.
- In-repo `tests/hlsl-intrinsic/system-values-draw-parameters.slang` (`-entry main -stage vertex -target metal`):
  `... float device* scales_0 [[buffer(0)]])`, a read-only SB in a non-void vertex fn. The test passes today because it
  only FileChecks the base_vertex/base_instance/amplification_id attributes.
- Same gap on every other path (scratch-14154/variants.slang):
  - ParameterBlock argument-buffer fields: `struct Params_default_0 { float device* pbScales_0; uint32_t device* pbRaw_0; ...}`.
  - Entry-point `uniform StructuredBuffer<float>` / `ByteAddressBuffer` params: `float device* entryPointParams_epSB_1`.
  - SB that leaks out of a ConstantBuffer: `packed_float4 device* gCB_cbSB_2`.
  - Helper fn param: `float4 helper_0(S_natural_0 device* b_1, uint i_0)`.
  All of these use the same emit site. RW forms (`gRW`, `gRWRaw`, `pbOut`) are the same text and must stay writable.
- Side observation (#6427, not this issue): the unused `gRW`/`gRWRaw` are still passed to the vertex fn `vmain`, so the warning
  would remain for them even after this fix.

## Codebase digest (FACT, file:line @6815ed82d)
- **Emit site:** `slang-emit-metal.cpp:1537-1542` emits `emitType(elem) + " device*"` for every `IRHLSLStructuredBufferTypeBase`.
  `:1543-1552` emits `"uint32_t device*"` for `kIROp_HLSLByteAddressBufferType`, `HLSLRWByteAddressBufferType` and
  `HLSLRasterizerOrderedByteAddressBufferType`, with no access check.
- **Legalize is not the layer.** `slang-ir-metal-legalize.cpp:160-170` (MetalAddressSpaceAssigner) maps both families to
  `AddressSpace::Global` and nothing else. `const` is an access property, not an address space, and these types reach emit as
  resource types, not `IRPtrType`.
- **Access is already in the representation.** Each access mode has its own opcode (HLSLStructuredBufferType = read-only;
  RW / RasterizerOrdered / Append / Consume are their own ops; ByteAddressBuffer likewise). The same opcode split is
  the source of truth in:
  - GLSL emit: `slang-emit-glsl.cpp:357` (`as<IRHLSLStructuredBufferType>` → `readonly`) and `:476` (`as<IRHLSLByteAddressBufferType>` → `readonly`).
  - Reflection: `spReflectionType_GetResourceAccess`, `slang-reflection-api.cpp:911-949` (SLANG_RESOURCE_ACCESS_READ vs READ_WRITE / RASTER_ORDERED / APPEND / CONSUME). The `:886-896` block is the SHAPE twin.
  So an opcode test is the canonical access check, not a type-name special case. No IR-level `getAccess()` exists for buffer types;
  `IRResourceTypeBase::getAccess` covers textures only. Metal textures already use it
  (`_emitHLSLTextureType` → access::read / read_write).
- **`const` precedent in the same switch:** `slang-emit-metal.cpp:1438-1443` emits a `const ` prefix → `const T device*` for
  BorrowInParam and for RefParam with Read access. The plain-PtrType access path (#14141's surface) is at `:1431-1471`.
- **Consistency:** every place the buffer type appears derives its text from the same IR type through emitType: entry params, the
  KernelContext struct fields + their assignments, argument-buffer struct fields, helper fn params, and the
  `kIROp_CastUInt64ToDescriptorHandle` cast at `:894-906`. So `const` on the buffer type reaches all of them at once (RW and read-only types never alias). The exception is
  compiler-made element-pointer temps, which have their own `Ptr` type (RISK SITE).
- **Pointer temporaries:** simple shapes fold inline (`(sb+i)->a_0`), but NOT always. See RISK SITE below (matrix-storage `_S6` temp).
- **Binding/reflection unaffected:** `slang-parameter-binding.cpp:1057-1065` (both kinds → LayoutResourceKind::MetalBuffer);
  slang-rhi `src/metal/metal-shader-object.cpp:259-275` setBuffer is the same for both. The emitted spelling has no effect on reflection.
- **Core-module casts:** cooperative-matrix Load from a buffer already casts `(const device $[0]*)` (hlsl.meta.slang ~:30928-30930,
  #10902). `simdgroup_store` casts `(device $[0]*)` (:30650), but it is only reachable from RW buffers.
- **RISK SITE (FACT, blocks a type-only fix):** the compiler creates element pointers into read-only buffers and
  materializes them as temporaries typed `T device*`. `slangc tests/metal/matrix-storage-packed-layout.slang -target metal` emits
  `_MatrixStorage_float3x3_ColMajornatural_0 device* _S6 = mats_1+_S5;` (line 36) for the read-only `mats`. The same happens in
  scratch-14154/ptrspace.slang. If `mats_1` becomes `const ... device*`, that line is an invalid const→non-const conversion in MSL.
  - Producers: `rwstructuredBufferGetElementPtr` on read-only bases, created by `deferBufferLoad` (`slang-ir-defer-buffer-load.cpp:284-292`,
    all targets) and `getBufferAddr` (`slang-ir-lower-buffer-element-type.cpp:1013-1025`). The result type is a plain `getPtrType(elem)`
    (`slang-ir.cpp:7353-7358`) → `Ptr(T, access=ReadWrite(0), Global(2))` in the final IR.
  - It is not always-folded: only FieldAddress/GetElementPtr are (`slang-emit-c-like.cpp:1546-1551`), so a multi-use element pointer becomes a temp.
- **Address spaces at emit (FACT, final-IR dump of ptrspace.slang):** a read-only buffer element ptr is `Ptr(T, 0, 2=Global)`.
  A user `Ptr<float, Access.Read>` is `Ptr(Float, 1=Read, 4294967297=UserPointer)`. They are distinguishable, so a `const` rule limited to
  `Global` + Read/Immutable leaves #14141's user-pointer output unchanged.
- **Hazard:** the atomic casts build a type name by concatenation, `"((atomic_" + emitType(ptr)` (`slang-emit-metal.cpp:399-400,476-484`). A `const`
  prefix there would print `atomic_const …`. It is unreachable for read-only pointers (no writes), but the fix must not add `const` there.
- **Safe / automatic:** BAB loads print `as_type<T>(buf[(off)>>2])` with no pointer cast (`slang-emit-metal.cpp:979-994`). On Metal,
  `treatGetEquivalentStructuredBufferAsGetThis` is set (`slang-emit.cpp:2266`), so there is no BAB→SB reinterpret. SB/BAB function
  params survive specialization and print through the same site. ParameterBlock fields → `DescriptorHandle<T>` print the inner
  resource type (`slang-ir-lower-buffer-element-type.cpp:3399-3412`). KernelContext fields use `getFullType()`
  (`slang-ir-explicit-global-context.cpp:339-342`). Append/Consume are rewritten to RWStructuredBuffer before emit
  (`slang-ir-lower-append-consume-structured-buffer.cpp:38,47`). `__getStructuredBufferPtr` / `__getByteAddressBufferPtr` are not
  available on Metal. `__getAddress(sb[i])` is rejected for read-only buffers (`slang-check-expr.cpp:7686-7699`).
- **Existing helper:** `isPointerToImmutableLocation` (`slang-ir-util.cpp:3594-3646`) already classifies HLSLStructuredBufferType /
  HLSLByteAddressBufferType (and element ptrs rooted in them) as immutable, for CUDA `__ldg`, redundancy removal and defer-buffer-load.
  The compiler already treats these buffers as read-only. There is no dedicated `isReadOnlyBufferType`.
- **`const T <space>*` spelling is already emitted:** `__constref` params print `float4 f_0(const S_0 thread* s_0)` (scratch borrow.slang).

## Candidate approaches
### Approach A: emit `const` for read-only buffer opcodes in the Metal type emitter (NECESSARY, NOT SUFFICIENT alone — see A+P)
- Where: `slang-emit-metal.cpp:1537-1552`. Prefix `const ` when the type is `kIROp_HLSLStructuredBufferType` or
  `kIROp_HLSLByteAddressBufferType`. Ideally use one shared IR helper (e.g. `isReadOnlyBufferResourceType(IRType*)` in
  slang-ir-util.h) that the GLSL `readonly` sites at `slang-emit-glsl.cpp:357/476` also use, so there is one source of truth.
- Behaviour delta: read-only SB/BAB → `const T device*` / `const uint32_t device*` at every use site (entry, KernelContext,
  argument-buffer fields, helper params, descriptor-handle unpack cast). RW, RasterizerOrdered, Append and Consume stay unchanged.
- Spelling choice: `const T device*` matches the existing `:1442` precedent and keeps the substring FileChecks passing, except
  `tests/metal/descriptor-handle-dynamic-dispatch.slang:51` `(float device*)(`. `const device T*` matches the reporter's text but breaks ~12
  FileCheck lines: tests/metal/{vector,matrix}-storage-packed-layout, pointer-in-storage-buffer-load:14, bugs/13074 :37-38,
  descriptor-handle-dynamic-dispatch:51, plus ~8 docs/generated/tests. Both are the same MSL type (qualifier order is free).
  Prefer the precedent order. Either way, add a new test that asserts `const` is present on read-only buffers and absent on RW ones.
- Tradeoffs: one small, local change; the representation is already correct, so no IR change. Docs
  `docs/user-guide/a2-02-metal-target-specific.md:88-89,108-113,196` must change (they also have the wrong `device* T` word order).
- Risk: **alone it produces invalid MSL**: the `T device* _S6 = mats_1+_S5` temporary (risk site above) becomes a const→non-const
  error. Needs companion P.

### Companion P: element pointers into read-only buffers carry `AccessQualifier::Read`; the Metal PtrType arm prints `const` for Read/Immutable in `Global`
- Where: (P1, Metal-scoped, smallest blast radius) a fix-up in `slang-ir-metal-legalize.cpp` after address-space assignment. Retype each
  `kIROp_RWStructuredBufferGetElementPtr` whose base is `HLSLStructuredBufferType` as `Ptr<T, Read, Global, layout>`. Or (P2,
  producer, cross-target) have `IRBuilder::emitRWStructuredBufferGetElementPtr` (`slang-ir.cpp:7353-7358`) derive access from the
  base type. Emit: `slang-emit-metal.cpp:1438-1443` adds `const ` when `addressSpace == Global && access ∈ {Read, Immutable}`.
- Behaviour delta: `const _MatrixStorage… device* _S6 = mats_1+_S5;`. RW element ptrs (access 0) are unchanged. User `Ptr<T, Access.Read>` /
  ImmutablePtr are `UserPointer`, so they are unchanged and #14141's surface is untouched.
- Tradeoffs: P1 touches Metal only. P2 is the root producer, but it changes ptr-type identity on every target (SPIR-V NonWritable at
  `slang-emit-spirv.cpp:7843-7855` keys on StorageBuffer + Read/Immutable; CUDA/HLSL dedup). Use `Read`, not `Immutable`: a
  Metal MTLBuffer can alias a writable binding, and if #14141 later maps Immutable → `constant`, Immutable element ptrs would
  move address space and mismatch their `device` base.
- Risk: medium-low. Keep `const` out of the atomic-cast concatenation (`:399-400,476-484`).

### Approach B: lower read-only buffers to `Ptr<T, Global, Access.Read>` in Metal legalization and teach the PtrType emit path `const`
- Where: slang-ir-metal-legalize.cpp / lower-buffer-element-type Metal policy, plus `slang-emit-metal.cpp:1431-1471`.
- Behaviour delta: the same MSL for buffers, but plain `Ptr<T, Access.Read>` user pointers would also become `const device T*`.
- Tradeoffs/Risk: a much larger rework. Metal never lowers SB/BAB to IRPtrType today, and the change touches buffer-element
  packing (`usesPackedVectorStorage` keys on address space; see the #14141 packing trap). It also **overlaps #14141**: it decides
  the user-pointer read-only semantics that #14141 has parked for maintainer direction. Rejected for this bug.

### Approach C: carry read-only as a param/var decoration (MemoryQualifierSet kReadOnly) and emit `const` at the declaration
- Rejected. The KernelContext fields, argument-buffer fields and helper params get their text from the type, not the var. A
  `const` param assigned into a non-const `float device*` field is ill-formed MSL (const→non-const). Read-only access has to live on
  the type, and it already does (opcode).

## Recommended path (solution brief, ≤15 lines)
- **Hypothesis (fact-backed):** the Metal type emitter ignores the read-only opcode for SB/BAB (`slang-emit-metal.cpp:1537-1552`).
  Element pointers into those buffers are typed as mutable `Ptr(T, ReadWrite, Global)`.
- **Fix:** A + P1. (1) Emit a `const ` prefix for `kIROp_HLSLStructuredBufferType` / `kIROp_HLSLByteAddressBufferType` via one shared
  read-only-buffer helper, reused by GLSL's `readonly` (`slang-emit-glsl.cpp:357,476`). (2) A Metal legalize fix-up retypes
  read-only-rooted `rwstructuredBufferGetElementPtr` as `Ptr<T, Read, Global>`. (3) `slang-emit-metal.cpp:1438-1443` adds `const` for
  Global + Read/Immutable only. User `UserPointer` pointers (#14141) stay unchanged. If the reviewer prefers P2 (builder-level), run the full suite on every target.
- **Repro:** `slangc sbvert.slang -target metal -line-directive-mode none` (body in issue) and
  `slangc tests/hlsl-intrinsic/system-values-draw-parameters.slang -entry main -stage vertex -target metal`.
- **Accept when:** (1) a new `tests/metal/readonly-buffer-const.slang` FileCheck (GPU-free, `-target metal`) shows `const` on read-only
  SB/BAB as: a vertex entry param, a KernelContext field, a ParameterBlock field, an entry-point `uniform` param, a helper-fn param,
  and a materialized element-ptr temp (the matrix-storage `_S6` shape). A user `Ptr<T, Access.Read>` stays `T device*`.
  It also shows NO `const` on RW SB/RWBAB, RasterizerOrdered or Append (CHECK-NOT). (2) Update the existing tests listed above if their spelling breaks.
  (3) Run `tests/metal/` and the `-target metal` lanes in `tests/` locally; all must pass. (4) The macOS CI Metal (`-mtl`) lane passes, since it compiles real MSL.
  (5) Update docs a2-02 tables. (6) RW buffers are unchanged byte-for-byte.
- **Out of scope:** #6427 (unused buffers not pruned → the same warning for an unused RW buffer); #14141 (user `Ptr` read-only → `constant`).

## Overlap with #14141 (orchestrator asked)
#14141 is about the plain `kIROp_PtrType` path (`slang-emit-metal.cpp:1431-1471`, user pointers, `constant` address space for perf).
#14154 is about the resource-type branch (`:1537-1552`). Companion P **does** touch the same PtrType `const` lines (`:1438-1443`), but scoped
to `AddressSpace::Global` (buffer-element pointers). User pointers are `UserPointer` (final-IR fact), so #14141's output does not change.
Line-level merge overlap only, with no semantic overlap. Approach B (lowering buffers to Ptr) would collide with #14141; it is rejected. The #14141 rejection of `const device` (no perf gain) does not apply here: the goal
is a correct read-only qualifier that silences a warning, not perf. This issue is not owned by the #14141 chain.

## Reporter PR intent
#14154 body: no offer to send a PR. On #14141 they asked "Would you accept a PR for option 2…" (direction first, then implement).
They are an active Metal contributor (#14011 open, #14148 open, #13943 merged, #14022 merged). So they plausibly could take this,
but they have not claimed it.

## Sources
- DeepWiki Q1: emitSimpleTypeImpl emits `T device*` for both SB forms and `uint32_t device*` for BAB; the IR distinguishes RO/RW; the
  address-space assigner maps both to Global. Q2: Metal textures pick access via SLANG_RESOURCE_ACCESS_*; the reflection helper
  classifies SB/BAB as READ vs READ_WRITE. Both were cross-checked against source above.
- Dup search: no duplicate. Related: #6427 (unused buffers not pruned, OPEN) and #14141 (read-only Ptr → constant, OPEN, same reporter).
  Unrelated: #7669, #11970, #13972 (GLSL readonly reflection), #14014/PR #14024 (getCount; does not touch emit-metal.cpp), #13796.
- Shared learnings: wiki concepts slang-backends-metal.md, slang-backends-metal-buffer-lowering-and-layout-rules.md, the #14141 learning.
- Scratch: /workspace/agent/scratch-14154 (sbvert.slang, variants.slang, ptrtemp*.slang + .metal outputs).

## Reporter's options comment (6574811444, 2026-11-02 10:26Z): review
They propose: (1) `const device` everywhere for SB/BAB, one change in `_emitType`; (2) entry-point params only, cast into KernelContext;
(3) everywhere except argument-buffer fields (to keep Metal reflection). They prefer 1 and ask whether the argument-buffer
reflection change (MTLBindingAccessReadOnly) is acceptable. They offer to write the PR. **Reporter owns the implementation (parent msg 4).**
- RIGHT: `_emitType` (`slang-emit-metal.cpp:1627`) is the entry and dispatches to `emitSimpleTypeImpl` (:1537-1552). The KernelContext, helper
  and PB fields follow from the one IR type.
- WRONG/INCOMPLETE: "pointers taken from such a buffer would become `const device T*` as well". The compiler-made element-ptr temps have
  their own `Ptr(T, ReadWrite, Global)` type, so they stay `T device*` → invalid MSL (matrix-storage `_S6`). Option 1 needs companion P.
- ADDED DATA for the reflection question: Slang reflection already reports read-only. slang-rhi does not use MTLArgumentEncoder; it memcpy's
  addresses and picks residency usage from Slang's binding type (`metal-shader-object.cpp:560-575`). The MTLBindingAccess claim is unverified (no Apple toolchain).
- No user pointer-taking path on Metal: `ByteAddressBuffer.GetBufferPointer()` → E36107 (scratch gbp.slang); `__getAddress(sb[i])` is rejected.
- **Decision owner:** csyonghe (author of the Metal explicit-context #3981 and the parameter-block lowering fix #8591; also the #14141 owner).
