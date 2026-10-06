---
title: Metal backend — emit bugs, intrinsic-string codegen, argument buffers, ray query, groupshared, buffer layout rules, and GPU-free repro
type: concept
group: slang-backends
tags: [metal, msl, emit, intrinsic-asm, texture, multisample, argument-buffer, precedence, dispatchmesh, repro, binding, register, ray-query, intersection-params, groupshared, threadgroup, buffer-layout]
source_count: 22
---

# Metal backend — emit bugs, intrinsic-string codegen, argument buffers, ray query, groupshared, buffer layout rules, and GPU-free repro

## TL;DR

Metal backend bugs and the discipline for reproducing them without a Mac/GPU:

- **Most Metal bugs are GPU-free reproducible** — Metal output is pure source-text emission, so `slangc -target metal` exhibits crashes (SIGSEGV/null-deref during source emission) AND wrong-emission bugs (precedence, invalid intrinsic strings) at compile time on Linux. "Metal is CI-only" is true for *runtime* behavior, not text-shape emitter bugs.
- **Texture-intrinsic emit lives in the core-module intrinsic-string layer** (`hlsl.meta.slang` `__intrinsic_asm` + `slang-core-module-textures.cpp`), NOT primarily in `slang-emit-metal.cpp`. That's the right single fix locus (keep the emitter dumb). Several MS/depth-texture bugs are *multisample-general or depth-specific*, decided by contrast controls (color vs depth, MS vs non-MS), NOT by the reported type.
- **C-style-cast cases in `tryEmitInstExprImpl` drop precedence parens** — they `return true` without `maybeEmitParens`, so `(T*)p->field` instead of `((T*)p)->field`. A family bug across several cases; the repro needs an INLINED single-use cast (a named local hides it).
- **Metal argument-buffer tier is a RUNTIME device capability, not a compile-time choice** — a portable argument-buffer struct compiles once and runs on both tiers; don't bake a tier into the program.
- **DispatchMesh/amplification legalization is Metal-only via VIRTUAL DISPATCH** (a per-target subclass override), not a call-site `if` — a "generic"-named legalization fn can be effectively single-target. Intrinsic-asm threads values only via `$`-operands; bare identifiers emit verbatim and need the name in lexical scope.
- **A Metal binding test must use an index the fallback cannot hit.** An unbound MSL kernel argument takes the first available index, so check an explicit `register(tN)` past every earlier slot, with distinct t/s numbers to avoid E39001.
- **A one-operand `makeVector(float4, packed_float4)` is Metal's packed→logical conversion, not a lane list.** `IRMetalPackedVectorType` is not an `IRVectorType`, so a peephole that treats a non-vector operand as one scalar lane stores a whole `packed_float4` into a float. Count a lane only for an `IRBasicType` operand matching the result's element type — compared via `unwrapAttributedType`, since `unorm`/`snorm`/`no_diff` operands are `IRAttributedType` and raw pointer equality silently loses folds.
- **Metal RayQuery flags map through inline `__requirePrelude` helpers in `hlsl.meta.slang` (`RayQuery::__reset`), not a prelude file.** 0x04 ACCEPT_FIRST_HIT_AND_END_SEARCH is `intersection_params::accept_any_intersection(true)` (same semantics as DXR/Vulkan); the getters (`get_*`, `should_*`) exist only in Apple's header, not the spec; Metal runtime ray-query lanes are ignored on macOS CI, so only `-target metallib` gives signal.
- **Metal/CPU `groupshared` becomes an entry-point-local var**, so `canInstHaveSideEffectAtAddress` lets barriers and callees forward/DSE across it; treat `AddressSpace::GroupShared` roots as globals, but keep param roots exempt. Threadgroup declarations take no initializer; cite SPIRV-Cross, not the MSL spec.
- **On Metal the buffer layout rule NAME is a lowering selector** (packing, struct clone, matrix lowering, `_natural`/`_default` type-name suffix), and CB `ScalarDataLayout` is silently ignored in IR and reflection alike. A new rule changes MSL identifiers and needs a layout IR op; diff whole files.
- **CI noise on Metal-only PRs**: a Falcor-Perf failure can NEVER be caused by a Metal-only diff (Falcor is D3D12/Vulkan, never compiles for Metal); priority-yield + "Artifact not found" is infra, not code.

## Metal is GPU-free reproducible

Most Slang Metal-backend bugs are inspectable via `slangc … -target metal` source emission with NO GPU/macOS runtime — including crashes: a null-deref during Metal *source* emission (e.g. `[outputtopology("point")]` mesh passing a scalar `OutputIndices<uint,N>`) makes `slangc` SIGSEGV (exit 139) right there. Use `SLANG_ASSERT=release-assert-only` and a prebuilt Debug `slangc` to demo it in seconds. The fold/hoist trap when reproducing *wrong-emission* bugs: an emit bug that only bites for non-trivial operands is masked because a compile-time-constant index gets constant-folded and a multi-use sub-expression gets hoisted to a temp — to surface the raw inline emission you need a runtime, single-use operand (e.g. drive an index from `SV_GroupIndex`, used once). Cross-check target divergence by emitting the same shader to `-target spirv-asm` for the correct reference ([reproducing Metal-backend bugs locally without a GPU + the fold/hoist trap](../learnings/1788374380808-reproducing-metal-backend-bugs-locally-without-a-g.md)).

## Texture-intrinsic emit bugs: run the contrast controls, fix in the core module

Metal read/gather/GetDimensions emission lives in the core-module intrinsic layer (`hlsl.meta.slang` `__intrinsic_asm` strings + the `slang-core-module-textures.cpp` generator), not primarily in `slang-emit-metal.cpp` — so that's the natural single fix locus. A reporter grouping several emit bugs under one "depth-texture path" was wrong for 2 of 3, proven by color-texture CONTROLS: `Texture2DMS.Load` (color) ALSO emits the invalid `int2` read coord (the MS `Load` metal branch passes coord `$1` raw while non-MS overloads wrap `vec<uint,2>((...).xy)`), and `Texture2DMS.GetDimensions` (color) ALSO emits `get_width(0)` with a LOD arg — both are MULTISAMPLE-general, not depth-specific; only the `DepthTexture2D.Gather` extra `metal::component(...)` is genuinely depth-specific. **When a reporter groups several emit bugs under one "path," run the contrast controls (color vs depth, MS vs non-MS, array vs non-array) before accepting the shared-locus framing** — the fix scope hinges on it, and a depth-scoped fix would silently leave color-MS broken ([Metal MS-texture emit: int2 read coord + get_width(lod) are multisample-general](../learnings/1786993599232-metal-ms-texture-emit-int2-read-coord-get-width-lo.md)).

Two of those became their own fixes. `DepthTexture2D.Gather` on `-target metal` emits `depth2d::gather(..., metal::component(0))`, but Metal's `depth2d::gather` takes NO component arg → the `.metal` fails to compile. The root cause is entirely in the `hlsl.meta.slang` `__texture_gather`/`__texture_gather_offset` metal arms appending `metal::component($n)` unconditionally — and the WGSL branch of the SAME function already has the fix (`if (isShadow == 1)` omits the channel), so mirror the WGSL guard in the Metal arm. **When triaging a per-target codegen bug, grep the other targets' arms of the same intrinsic function — a sibling backend frequently already implements the correct guard.** Trap: the public `Gather` template's `isShadow` is a generation-loop variable (Cmp-vs-plain), NOT the texture's depth flavor; the real guard must live inside `__texture_gather`'s per-target arm. Decisive control: a `Texture2D` control emits a byte-identical gather line ([Metal depth-texture gather bug: WGSL branch already has the isShadow guard](../learnings/1786994230312-metal-depth-texture-gather-bug-wgsl-branch-already.md)). Separately, `Texture2DMS`/`DepthTexture2DMS.GetDimensions` emits `get_width(0)` with a lod arg that MS textures don't accept: `TextureTypeInfo::writeGetDimensionFunctions()` hard-codes `metalMipLevel = "0"` across 6 sites; because the mip-info overload is skipped for MS textures, `includeMipInfo` stays 0 and the override to `"$1"` never runs. One-line fix: `metalMipLevel = isMultisample ? "" : "0";`. The report named only `DepthTexture2DMS` but the trigger is `isMultisample`, so run the per-flavor control matrix ([Metal GetDimensions on multisample textures emits invalid get_width(0) lod arg](../learnings/1786994294348-metal-getdimensions-on-multisample-textures-emits-.md)).

Not every Metal abort is in the address-space family, either: a `[mutating] ref` accessor aborts Metal emit with `Unknown addressspace encountered`, but this is a single upstream lower-to-ir producer bug, not an addr-space-pass bug — `visitReturnStmt` has no ref-accessor special case, so `return _v;` LOADS the pointer and the emitted helper returns `Int` while the func type says `Ptr(Int)`. ONE root, four target symptoms (Metal canary; SPIR-V invalid module; HLSL/GLSL/WGSL silent lost-write). The reusable triage: for a Metal "Unknown addressspace" abort, check whether the offending function's body RETURN matches its declared pointer-return type before assuming the addr-space seeding family ([Metal 'Unknown addressspace' from ref accessor is a lower-to-ir return-value bug](../learnings/1786484201483-metal-unknown-addressspace-from-ref-accessor-is-a-.md)).

## C-style-cast precedence parens: a family bug in tryEmitInstExprImpl

`MetalSourceEmitter::tryEmitInstExprImpl` special-cases several ops that emit a C-style cast `(T)(operand)` and then `return true` WITHOUT calling `maybeEmitParens` — so `inOuterPrec` is ignored and required parens are dropped when the cast is the base of a postfix `->`/`.` (e.g. `(T*)p->field` instead of `((T*)p)->field`, which fails native Metal compilation). It is NOT one branch: the pointer `kIROp_BitCast`, `kIROp_CastDescriptorHandleToUInt64`, and `kIROp_CastUInt64ToDescriptorHandle` cases share the defect. The correct pattern (already in the generic `slang-emit-c-like.cpp`): a C-style cast is `EmitOp::Prefix` precedence, member access emits its base at `EmitOp::Postfix`, `Prefix < Postfix`, so `maybeEmitParens(outerPrec, getInfo(EmitOp::Prefix))` correctly adds the parens ([Metal emitter C-style-cast cases drop precedence parens (family bug)](../learnings/1787659804370-metal-emitter-c-style-cast-cases-drop-precedence-p.md)).

The fix (slang#12732 / PR #12741, merged) came with repro/test lessons: the paren bug only manifests when the cast is INLINED as the base of `->` — a named local hoists it to a temp and hides it, so use a single-use inlined expression (`outputBuffer[3] = bit_cast<Data*>(q)->value;`). `maybeEmitParens` is NOT strict-precedence-only — it also force-adds parens for bitwise/logical/relational/equality contexts, so don't claim "parens added only when precedence strictly requires"; say it "follows the emitter's precedence policy." FileCheck discriminators must assert the CLOSING boundary (`))->value`), not just the opening `((Data`, and must be verified to REJECT the buggy emit ([Metal cast-paren bug: repro needs an INLINED cast; Falcor-Perf/priority-yield CI is infra](../learnings/1788298129501-metal-cast-paren-bug-repro-needs-an-inlined-cast-f.md)). From the approver side, this class was confirmed low-risk: a Metal emit change that adds parenthesization via the shared precedence machinery adds parens ONLY in tighter-than-Prefix contexts, so output is byte-identical in the common statement/assignment context and untouched COUNT tests don't regress — a CHECK for the new boundary + green Metal test check-runs is sufficient, unlike an *unconditional* token change which still warrants a full COUNT audit ([Merge-join #12741: Metal precedence-wrapping is low-risk for the COUNT-test class](../learnings/1788298167079-approver-human-disagreement-merge-join-12741-metal.md)).

## Argument buffers and DispatchMesh legalization

Metal tier-1 vs tier-2 argument buffers is a RUNTIME device capability (`MTLDevice.argumentBuffersSupport`), NOT a compile-time / MSL-version choice — tier-1 is a universal baseline, tier is a GPU-family attribute, and a portable argument-buffer struct compiles ONCE and runs on BOTH tiers (the host adapts at runtime). Slang already emits a single MSL form regardless of tier; any design that BAKES a tier into the compiled program forfeits compile-once-run-both. Slang's layout encoding already stores multiple offsets per field, one per `LayoutResourceKind`, so no new encoding is needed to hold a byte offset AND a slot offset — the difficulty is PRODUCTION (the default Metal PB ruleset emits only slots, the tier-2 ruleset only Uniform bytes); the principled fix is ONE argument-buffer-contents ruleset returning BOTH per field. Architectural smell to watch: invoking front-end layout rules from IR lowering/linking (on master `slang-lower-to-ir.cpp` has zero such calls); when byte layout must be produced post-front-end, carry the rule choice as an IR type operand and derive it in an IR pass (the `ConstantBuffer<T,Layout>` model) ([Metal argument-buffer tier is runtime, not compile-time](../learnings/1787595516314-metal-argument-buffer-tier-is-runtime-not-compile-.md)).

DispatchMesh (amplification) legalization is Metal-only via VIRTUAL DISPATCH: `legalizeAmplificationStageEntryPoint` is a `virtual` on the base context whose base body is an empty no-op, overridden only by `LegalizeMetalEntryPointContext` (WGSL inherits the no-op; CPU/CUDA use free functions) — so a "generic"-named legalization fn can be effectively single-target; check for a per-target subclass override before assuming it runs everywhere. `__intrinsic_asm` string substitution threads values ONLY via `$0..$N` (the IR call's operands); bare identifiers (Metal's `_slang_mesh_payload`, `_slang_mgp`) are emitted verbatim as source text and require that exact name to be in lexical scope at the emit site (they resolve via synthesized `IRParam`s carrying `IRExternCppDecoration`), which is why the fix inlines helpers containing the call. The standard mechanism to expose an entry-point value to a helper is to thread it as an `IRCall` operand OR inline the helper (`performForceInlining` runs pre-emit) — inlining-to-bring-a-value-into-scope is an established pattern, not a hack ([Metal DispatchMesh legalization: intrinsic-asm operand-vs-name threading, virtual-dispatch target gating](../learnings/1788394097476-metal-dispatchmesh-legalization-intrinsic-asm-oper.md)).

## Binding tests: Metal's first-available-index fallback hides a dropped attribute (#12294)

MSL 4.1 §5.2.1 gives a kernel argument without an explicit `[[buffer(N)]]`/`[[texture(N)]]`/`[[sampler(N)]]` "the first available location index". So a FileCheck that requires only *some* binding attribute, or one at index 0, can pass even when the emitter drops the attribute, because Metal's fallback lands in the same slot the layout chose. To prove a binding fix is needed, give the resource an explicit `register(tN)`/`register(sN)` whose index is past everything declared before it, and check the red-before-fix run. On slang#12294 the first choice, `t8`, still coincided: two unbound 4-element texture arrays declared earlier already filled slots 0-7. Also, `register(t8)` together with `register(s8)` on arrays raises E39001 (overlap in the Vulkan binding space) even when targeting Metal, so use distinct numbers (`t16`/`s12` worked). Codex OUTPUT_REVIEW caught both ([Metal binding tests: zero-based indices can pass on a buggy emitter](../learnings/1790695616872-metal-binding-tests-zero-based-indices-can-pass-on.md)). The same PR's `-target metallib` smoke line has its own false-green: see [slang-test-output-assertions-and-truncated-runs](slang-test-output-assertions-and-truncated-runs.md).

## Packed buffer vectors: a one-operand `makeVector` is a conversion, not a lane list

Metal buffer lowering converts between `vector<T,N>` and `IRMetalPackedVectorType` with a
one-operand `makeVector`. `__unpackVector` in `slang-ir-lower-buffer-element-type.cpp` (~:3041,
plus :2312 and :3069) emits `makeVector(float4, packed_float4Load)` and
`makeVector(packed_float4, v)`, and `slang-emit-metal.cpp:764` prints the first as `float4(p)`.
`IRMetalPackedVectorType` is a sibling of `IRVectorType`, not a subtype, so `as<IRVectorType>`
returns null for it. Any peephole that maps `makeVector` lanes to operands and assumes "not a
vector ⇒ one scalar lane" therefore mis-folds this shape: `swizzle`/`GetElement` lane 0 becomes
the whole `packed_float4`, and `StructuredBuffer<float4> c; out[i] = c[i].x;` on `-target metal`
emits `*(out+i) = *(c+i)`, storing a packed vector into a float. Master (checked 2026-09-30 at
16c3d3f686) already miscompiles `c[i][0]` this way through its `GetElement(makeVector)` fold, and
the swizzle fold on branch fix/issue-13263 extended the bug to `.x` and `.xx`. The fix counts an
operand as one lane only if it is an `IRBasicType` whose type equals the result's element type,
reads that element type from either `IRVectorType` or `IRMetalPackedVectorType` instead of
assuming the result is an `IRVectorType`, and otherwise gives up
[one-operand makeVector(float4, packed_float4) is a conversion](../learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md),
[one-operand makeVector can be a Metal packed-vector conversion](../learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md).
That element-type equality must compare `unwrapAttributedType(...)` (`slang-ir-util.h:364`) on both
sides, not raw type pointers: `IRInst::getDataType()` strips only `IRRateQualifiedType`
(`slang-ir.cpp:8975`), so a `unorm float` operand is `IRAttributedType(float, UNorm)` and never
pointer-equals `float`. The front end lets such modifiers drop during coercion, so these values do
reach `makeVector` operands (`float2(RWTexture2D<unorm float>[id], 0.0)`). On fix/issue-13263 R2
(8a76ecc5f1) the raw check in `findMakeVectorLane` silently lost master's fold of
`float2(tex[id], 0.0).y` → `0.0f` — output stayed correct, so only a differential compile caught it:
build a base-reverted and a head binary, compile the ~1331-test corpus × spirv/hlsl/metal with
`xargs -P 48` and diff the stripped outputs (about 3 minutes). `__vectorReshape<1>(uint3(...))` is
callable from user code and is a handy trigger for `vector<T,1>`-typed swizzles in tests
[IR type-pointer equality misses IRAttributedType](../learnings/1790769162592-ir-type-pointer-equality-misses-irattributedtype-u.md).
The full slang-test suite did not catch it, because `tests/metal` is text-only FileCheck with no
case for this shape; a peer reviewer found it by probing `-target metal`. The regression test is
`tests/metal/swizzle-of-packed-vector-load.slang`, which checks that the output still goes
through `float4(`.

## RayQuery ray flags → `raytracing::intersection_params` (#13408)

Metal translates `RAY_FLAG` bits into an `intersection_params` value in
`_slang_ray_flags_to_intersection_params`. That helper is not in a prelude file. It is a
`__requirePrelude(R"(...)")` string inside `RayQuery::__reset` in `source/slang/hlsl.meta.slang`
(~:21884 @92258f61b), and its only caller is TraceRayInline's `case metal:`, which passes
`rayFlags | rayFlagsGeneric`, so the template flags on `RayQuery<...>` take the same path.
`RayFlags()` uses the inverse helper `_slang_intersection_params_to_ray_flags` (~:22885). Since
#9926 both helpers have lacked 0x04 `ACCEPT_FIRST_HIT_AND_END_SEARCH`; Copilot and CodeRabbit
flagged it on that PR and nobody replied. The MSL call is `params.accept_any_intersection(true)`,
which is what SPIRV-Cross `spvMakeIntersectionParams` (spirv_msl.cpp) emits for
TerminateOnFirstHit, so SPIRV-Cross's MSL helpers are the prior art for auditing any Metal flag
mapping. Edits need the core-module rebuild sequence, and a `-target metal` FileCheck on the helper
body verifies them GPU-free
[Metal RayQuery ray flags are mapped by inline __requirePrelude helpers](../learnings/1790964538262-metal-rayquery-ray-flags-are-mapped-by-inline-requ.md).

The semantics match. The MSL 4.1 spec (2026-06-04) intersection-function return table says "Even if
true is returned, a committed hit will immediately halt searching if accept_any_intersection() is
true." That is DXR `RAY_FLAG_ACCEPT_FIRST_HIT_AND_END_SEARCH` and Vulkan TerminateOnFirstHit:
search stops on the first committed hit, and non-opaque or procedural candidates still reach user
code first. The spec has no opacity-micromap feature, so flag 0x400 has no Metal equivalent
[MSL spec 4.1: accept_any_intersection halts on first committed hit](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md).

The round trip in `RayFlags()` needs getters, and the spec does not document any. The spec (§6.19.3,
Table 6.32) lists only setters (`force_opacity`, `set_*_cull_mode`, `accept_any_intersection(bool)`)
plus `intersection_query::get_intersection_params()`. Apple's shipped `<metal_raytracing>` header
has the getters anyway: `get_forced_opacity()`, `get_triangle_cull_mode()`,
`get_geometry_cull_mode()`, `get_opacity_cull_mode()`, `get_geometry_type()`, and, for the bools,
`should_accept_any_intersection()` and `should_assume_identity_transforms()`.
`get_intersection_params()` fills them from the live query, so the round trip reads real state. A
search for `get_accept_any_intersection` finds nothing, which is how CodeRabbit on #9926 wrongly
concluded there was no getter. Header copies are readable without a Mac via raw.githubusercontent.com
on dortania/PatcherSupportPkg (`Universal-Binaries/<macOS>/System/Library/PrivateFrameworks/GPUCompiler.framework/Versions/<N>/Libraries/lib/clang/<ver>/include/metal/metal_raytracing`,
GPUCompiler 31001/32023 trees at commit 94354f9de4f). The gh API tree endpoint returns 401 through
the proxy, but raw URLs work
[intersection_params getters exist only in Apple's header](../learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md),
[Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md).
The spec PDF is over 10 MB, so WebFetch fails on it. To search it without pdftotext or pypdf,
download it with curl, zlib-decompress each `stream…endstream` block in Python, and join the
`(...)` Tj strings
[MSL spec 4.1: accept_any_intersection halts on first committed hit](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md).

Test with a `-target metallib` SIMPLE lane. A Metal runtime ray-query lane gives no CI signal:
`//TEST(compute, metal):COMPARE_COMPUTE_EX … -metal … -render-feature ray-query` lanes are reported
as `ignored test: … (mtl)` on test-macos-release-clang-aarch64 (merge_group run 37043131359,
2026-10-02; e.g. tests/metal/ray-query-intrinsics.slang.2, the only enabled mtl lane ignored in
tests/metal while 29 others pass). Only the metallib lane proves the MSL compiles with Apple's
compiler, so do not accept "the macOS Metal runtime lane is the hardware check" in a PR claim.
Vulkan ray-query lanes do run on test-windows-*-gpu-vk
[Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md).

## `groupshared` on Metal: a function-local var, and threadgroup declarations take no initializer (#13409)

On Metal (and CPU targets), `introduceExplicitGlobalContext` (slang-ir-explicit-global-context.cpp:556-575)
turns each `groupshared` global into an entry-point-local `var` with `AddressSpace::GroupShared`.
Other GPU targets keep an `IRGlobalVar`, and CUDA deliberately skips the hoist.
`canInstHaveSideEffectAtAddress` (slang-ir-util.cpp ~1442, `kIROp_Call` arm) skips its "an opaque
call may write anything" check when the root is a child of the function. A
`GroupMemoryBarrierWithGroupSync()` call (no arguments) or a `[noinline]` callee that writes the
slot through KernelContext is therefore treated as not modifying it, and three consumers
miscompile: `tryRemoveRedundantLoad` (forwards across a barrier), `simplifyForEmit`
`processLoadUse` (moves a re-load past a barrier), and `tryRemoveRedundantStore` (DSE). To triage a
"load moved across a barrier on Metal" report, compare `-dump-ir` after `simplifyNonSSAIR`
(forwarding) with the final IR: if the final IR still has the right store, the re-load comes from
`simplifyForEmit`. The emitter's fold check is not the culprit; it uses `mightHaveSideEffects`, and
the barrier blocks it. A safe prototype fix also treats roots whose pointer type has
`AddressSpace::GroupShared` as globals in that arm. The broader inversion, "only private local vars
are immune", breaks `inout` copy-in/copy-out: after `undoParameterCopy` an `inout` is a pointer
param, and `x = t; barrier; return x` starts re-reading another thread's value, so param roots need
an exemption. The same predicate also forwards through a pointer loaded inside the function
(`uint* q = cb.p; *q = 1; w(); outb = *q` gives 1) on all targets including SPIR-V, since filed as
#13412; the predicate's other unsound exemptions (escaped locals, pure callees) are on
[Slang IR passes](../concepts/misc-f0909b7-slang-ir-optimization.md)
[Metal/CPU groupshared is a function-local var after introduceExplicitGlobalContext](../learnings/1790967869022-metal-cpu-groupshared-is-a-function-local-var-afte.md).

The same issue's second bug is the C-like emitter folding a store into the `threadgroup`
declaration. It reproduces only when the variable is read later, for example by an atomic
(`s = tid.x; barrier; InterlockedAdd(s,1,old);` gives `threadgroup uint s_0 = tid_0.x;`). A plain
store with no later read is removed as dead code, and `-g` also hides the fold. Do not cite the MSL
spec for the "no initializer on threadgroup vars" rule: v4.1 §4.4 (p.120-121) only shows
uninitialized declarations, and a full-text grep finds no sentence forbidding `threadgroup T x = v;`.
Web answers quoting "cannot be declared and initialized at the same time" describe older or
OpenCL-style wording. Cite SPIRV-Cross `spirv_msl.cpp:3868` (main aa217aeb6c9f), "Cannot directly
initialize threadgroup variables. Need fixup hooks.", which emits the initializer as a separate
assignment. Without a Metal toolchain, a `-target metallib` test on macOS CI is the only real proof
[MSL spec doesn't state the no-initializer-on-threadgroup rule](../learnings/1790984185438-the-msl-spec-doesn-t-state-the-no-initializer-on-t.md).

## Buffer layout rules on Metal: CB data-layout parameter ignored, and the rule NAME is a lowering selector (#13423)

On Metal (master 6ba151dcf), `ConstantBuffer<T, ScalarDataLayout>` and `-fvk-use-scalar-layout` are
silently ignored for constant buffers. The CB keeps native MSL `float3` (16 bytes), while
`StructuredBuffer<T>` is packed (`packed_float3`, 12 bytes, since #11578, between v2026.2 and
v2026.12). `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2416-2417)
returns Natural for every non-Khronos, non-LLVM target before it reads the buffer's explicit data
layout. `MetalBufferElementTypeLoweringPolicy::usesPackedVectorStorage` (:2991-3003) packs only the
StorageBuffer/UserPointer address spaces, and CBs are Uniform. Reflection's
`MetalLayoutRulesFamilyImpl::getConstantBufferRules` (slang-type-layout.cpp:2799) ignores both the
options and the container type. Emitted MSL and reflection agree (B@16), so nothing miscompiles;
the request is dropped with no diagnostic. Across targets, SPIR-V honors CB ScalarDataLayout,
HLSL/WGSL ignore it, CUDA/CPP are natural anyway, and `Std140DataLayout`/`Std430DataLayout` on Metal
give E36107. A fix must change IR and reflection in lock step, including the Tier-2 family at
type-layout.cpp:2869. Avoiding `float3` alone does not make native and scalar layouts coincide
(`float x; float4 y;` puts y at 16 native vs 4 scalar), so verify offsets per target with
`-reflection-json`
[Metal ConstantBuffer ignores the L data-layout parameter](../learnings/1791056669263-metal-constantbuffer-ignores-the-l-data-layout-par.md).

The `IRTypeLayoutRuleName` does more than pick layout numbers on Metal. The emitter never prints
strides or offsets (`array<T,N>` uses only operands 0 and 1, emit-metal.cpp:1472), but three
lowering gates read the rule name: `usesPackedVectorStorage` packs only for Natural, the struct
`isTrivial` check clones a struct when the rule is not Natural, and `shouldLowerMatrixType` leaves a
default-major matrix alone only for Natural. The name also becomes the `_natural`/`_default` suffix
of lowered type names through `getLayoutName`. Adding a rule name to a buffer class therefore changes
emitted MSL identifiers (`Args_natural_0` becomes `Args_default_0`) even when the layout is
unchanged. A "byte-identical" prototype claim on #13423 (a ~25-line change honoring only explicit
annotations) was false for exactly this reason, so diff whole files, identifiers included. A new rule
also needs a layout IR op: `fixBufferAccessPointerTypes` stamps `getOpFromTypeLayoutRuleName(rule)`
on derived pointers, and with no case for the new rule it falls back to `DefaultBufferLayoutType`,
which pointer queries map to Natural, leaving the buffer with two contradicting layouts
(`MetalParameterBlockLayout` is the precedent). `extras/check-ir-stable-names.lua update` re-sorts
and drops unrelated entries, so add the stable-name line by hand and then run `check`
[IR layout rule NAME is a lowering selector and leaks into MSL type names](../learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md).
The same function's exact-target checks are what break the WGSL-via-Tint path; see
[GLSL/WGSL emit and buffer layout](../concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md).

**Source learnings (22):**
- [Metal binding tests: an unbound kernel arg takes the first available index, so a zero-based or attribute-presence check passes on a buggy emitter; pick an index past all earlier slots and avoid t/s overlap (E39001) (#12294)](../learnings/1790695616872-metal-binding-tests-zero-based-indices-can-pass-on.md)
- [Metal lowering uses a one-operand makeVector(float4, packed_float4) as a conversion — don't count non-IRVectorType operands as scalars](../learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md) — master's `c[i][0]` already miscompiles
- [Slang IR: a one-operand makeVector can be a Metal packed-vector conversion, not a lane list](../learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md) — match element types; test tests/metal/swizzle-of-packed-vector-load.slang
- [IR type-pointer equality misses IRAttributedType (unorm/snorm/no_diff); use unwrapAttributedType in peephole type checks](../learnings/1790769162592-ir-type-pointer-equality-misses-irattributedtype-u.md) — `getDataType()` strips only rate qualifiers; differential corpus compile caught a lost fold; `__vectorReshape<1>` trigger.

- [reproducing Metal-backend bugs locally without a GPU + the fold/hoist trap](../learnings/1788374380808-reproducing-metal-backend-bugs-locally-without-a-g.md) — Metal source emission (incl. SIGSEGV crashes) is GPU-free; use a runtime single-use operand to defeat constant-fold/hoist masking; cross-check `-target spirv-asm`.
- [Metal MS-texture emit: int2 read coord + get_width(lod) are multisample-general, not depth-specific](../learnings/1786993599232-metal-ms-texture-emit-int2-read-coord-get-width-lo.md) — color controls proved 2 of 3 "depth" bugs are MS-general; texture emit lives in the core-module intrinsic layer; run contrast controls before accepting a shared-locus framing.
- [Metal depth-texture gather bug: WGSL branch already has the isShadow guard Metal lacks](../learnings/1786994230312-metal-depth-texture-gather-bug-wgsl-branch-already.md) — `depth2d::gather` takes no component arg; mirror the WGSL `if(isShadow==1)` guard in the Metal `__texture_gather` arm; two same-named `isShadow` variables mean different things.
- [Metal GetDimensions on multisample textures emits invalid get_width(0) lod arg](../learnings/1786994294348-metal-getdimensions-on-multisample-textures-emits-.md) — `metalMipLevel="0"` hard-coded across 6 sites; fix `= isMultisample ? "" : "0"`; run the per-flavor control matrix (trigger is isMS, not depth).
- [Metal 'Unknown addressspace' from ref accessor is a lower-to-ir return-value bug](../learnings/1786484201483-metal-unknown-addressspace-from-ref-accessor-is-a-.md) — `visitReturnStmt` lacks a ref-accessor case, loads the pointer; one producer root, four target symptoms; not the addr-space seeding family.
- [Metal emitter C-style-cast cases drop precedence parens (family bug)](../learnings/1787659804370-metal-emitter-c-style-cast-cases-drop-precedence-p.md) — `return true` without `maybeEmitParens` across the bitcast + descriptor-handle-cast cases; mirror the generic `EmitOp::Prefix` wrap.
- [Metal cast-paren bug: repro needs an INLINED cast; Falcor-Perf/priority-yield CI is infra](../learnings/1788298129501-metal-cast-paren-bug-repro-needs-an-inlined-cast-f.md) — a named local hides the bug; `maybeEmitParens` is not strict-precedence-only; assert the closing boundary; Falcor-Perf can't be caused by a Metal-only diff.
- [Merge-join #12741: Metal precedence-wrapping is low-risk for the COUNT-test class](../learnings/1788298167079-approver-human-disagreement-merge-join-12741-metal.md) — shared-precedence-machinery parenthesization adds parens only in tighter-than-Prefix contexts → byte-identical in common contexts; unconditional token changes still need the COUNT audit.
- [Metal argument-buffer tier is runtime, not compile-time — encode both offsets](../learnings/1787595516314-metal-argument-buffer-tier-is-runtime-not-compile-.md) — tier is a runtime device capability; one struct runs both tiers; layout encoding already holds multi-kind offsets; one contents-ruleset returning both is the principled fix; don't call front-end layout from IR.
- [Metal DispatchMesh legalization: intrinsic-asm operand-vs-name threading, virtual-dispatch target gating](../learnings/1788394097476-metal-dispatchmesh-legalization-intrinsic-asm-oper.md) — amplification legalization is Metal-only via a virtual override; `$`-operands vs verbatim bare identifiers (needing in-scope `IRParam`s); inline-to-bring-into-scope is the standard pattern.
- [Metal RayQuery ray flags are mapped by inline __requirePrelude helpers in hlsl.meta.slang (no 0x04 before #13408)](../learnings/1790964538262-metal-rayquery-ray-flags-are-mapped-by-inline-requ.md) — helper lives in `RayQuery::__reset`; 0x04 → `accept_any_intersection(true)`; SPIRV-Cross is prior art.
- [MSL spec 4.1: accept_any_intersection halts on first COMMITTED hit; getters are header-only](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md) — matches DXR/Vulkan terminate-on-first-hit; no OMM (0x400); how to grep the >10 MB PDF.
- [Metal intersection_params getters exist only in Apple's header; bool getters are named should_*](../learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md) — read the header via dortania raw URLs; add metallib + runtime lanes.
- [Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md) — only `-target metallib` SIMPLE lanes give Apple-compiler signal.
- [Metal/CPU groupshared is a function-local var after introduceExplicitGlobalContext (#13409)](../learnings/1790967869022-metal-cpu-groupshared-is-a-function-local-var-afte.md) — `canInstHaveSideEffectAtAddress` treats barriers/callees as not touching it; GroupShared-address-space fix; param roots need an exemption.
- [The MSL spec doesn't state the 'no initializer on threadgroup vars' rule; cite SPIRV-Cross instead](../learnings/1790984185438-the-msl-spec-doesn-t-state-the-no-initializer-on-t.md) — spirv_msl.cpp:3868; the fold repro needs a later read (atomic); `-g` hides it.
- [Metal ConstantBuffer ignores the L data-layout parameter (ScalarDataLayout) in both IR and reflection](../learnings/1791056669263-metal-constantbuffer-ignores-the-l-data-layout-par.md) — dropped silently, IR and reflection agree; fix both in lock step; verify offsets with -reflection-json.
- [Slang IR layout rule NAME is a lowering selector and leaks into MSL type names](../learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md) — gates packing/struct clone/matrix lowering; `_natural`→`_default` identifiers; add a layout IR op; hand-edit stable names.
