---
title: "Slang SPIR-V debug info: -g levels, DebugSource/DebugLine, debug types, debug variables, and OpName"
type: concept
group: slang-backends
tags: [spirv, debug-info, nonsemantic, g0, g2, DebugSource, DebugLine, DebugTypeMatrix, DebugTypeComposite, DebugValue, DebugDeclare, dbgvar, spirv-opt-adce, OpName, spirv_asm, separate-debug-info]
source_count: 35
---

# Slang SPIR-V debug info: -g levels, DebugSource/DebugLine, debug types, debug variables, and OpName

Producer/consumer rules for SPIR-V debug info. `DebugFunction` records are on [[wiki/concepts/slang-backends-spirv-debug-function-info.md]].

## TL;DR

- SPIR-V debug-info defects are almost always producer-side (lowering, IR type gates); the emitter is innocent except for debug type records, which it builds.
- `-g0` emits exactly `OpSource`, `OpName` and `OpMemberName` by design (SPIR-V only). For "g0 still emits X", check whether X is a direct `emitInst` or a surviving decoration.
- Source-text embedding is gated at two layers with two `IRDebugSource` producers; update both and gate SPIR-V-only flags on the target.
- `-g1 OpLine` / `-g2 DebugLine` come only from statement-level `IRDebugLine` markers, so a value-inst `sourceLoc` fix changes SPIR-V by zero bytes and has no golden test.
- `-g2` embeds the source, CHECK lines included: anchor on `%id = OpString "name"`. Hoistable dedup needs byte-identical operands from every producer (#11982).
- `linkIR` keeps the `DebugSource`+CU of every imported module, used or not (#13982). Ownership must come from the producer (CU operands list the TU's `#include`d sources); reachability and `isIncludedFile` are not ownership tests.
- `IRDebugScope` is variable-arity (never a null operand). A matrix's debug type is layout-independent.
- Opaque-handle locals: the emitter handles them; admit them at the leaf/creation type gates with a narrow texture/sampler predicate, never in recursive `isDebuggableType`; test `let` and `var`.
- DebugVar type-eligibility and DebugValue representability are separate checks; `ArgNumber` remapping is cross-cutting (flag it).
- The maintainer rejects side-channel debug decorations (#13872 `DebugVarStorage`): debug IR mirrors NSDI/DWARF (IR `DebugDeclare(var, storage)`, PR #14114) and every pass transforms an inst's debug insts with it; substituting passes otherwise retarget a DebugDeclare onto non-pointer storage (E40007).
- A reference to a function-local inst breaks where params move or are cloned: exclude entry points, return `LegalVal()` in legalize-types, remap with `findCloneForOperand` after params-first cloners. A clean `-g2` suite sweep does not prove cloner coverage.
- At `-g2 -O0` each local gets a `_dbgvar_*` shadow; at `-O1` spirv-opt ADCE duplicates DebugValues and deletes store-only shadows with their `DebugDeclare`. The `-O` difference is spirv-opt, not Slang IR.
- Every named `%id` in a `spirv_asm` block gets an `OpName`; stdlib registers are `__`-prefixed. Settle "wrong debug name" claims with a rename drill.
- spirv-opt strip-debug deletes `DebugBuildIdentifier` (`-separate-debug-info` needs a shim); the `DebugEntryPoint` string hardcodes `-g2` and drops un-cased options.
- spirv-val does not validate NonSemantic debug info; these defects ship at rc=0.

## Debug levels and source embedding

**`-g0` emits exactly `OpSource`, `OpName` and `OpMemberName`.** `OpSource` is an unconditional `emitInst`; the names come from `IRNameHintDecoration`, which `stripDebugInfo` (removing only `IRDebug*`) keeps. `OpLine` and the `DebugSource` `OpString` are g1+. SPIR-V only (DXIL/HLSL/Metal `-g0` emits nothing); documented in help text (#11682/#12201) ([-g0 doesn't zero](../learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md), [exactly three](../learnings/1784828289031-g0-debuginfolevel-none-emits-exactly-opsource-opna.md)).

**Source embedding is gated at two layers (#12181, PR #12202).** Producer (`slang-lower-to-ir.cpp:15425`): no `IRDebugSource` at `-g0`, empty content at `-g1`, embedded source at `-g2/-g3`; `DebugCompilationUnit` only at `>= Standard`. Consumer (`slang-emit-spirv.cpp:2164`): only the filename `OpString` at `Minimal`. A flag embedding source at a lower level (`DebugInfoIncludeSource`) must thread both layers, and at `-g0` needs a minimal CU plus `SPV_KHR_non_semantic_info` ([two layers](../learnings/1784666850986-slang-spir-v-source-text-embedding-is-gated-at-two.md)). The two `IRDebugSource` producers are the per-file loop (~15428) and `getOrEmitDebugSource` (~9717); updating one yields an `OpSource` with a File operand and empty Source. The producer ternary is target-agnostic (LLVM embeds too): gate the flag on SPIR-V or warn, like `-separate-debug-info` ([two producers](../learnings/1784822669473-slang-debug-info-include-source-12181-12202-second.md)). A bare fileless `OpSource` beside file-carrying ones makes SPIRV-Tools' extractor create a spurious `unnamed-0.hlsl` (spirv-val passes); emit the bare record only in the no-embed branch ([bare OpSource](../learnings/1784851566899-slang-spir-v-emitting-a-bare-fileless-opsource-alo.md)).

**Line markers come from statements (#12192).** `-g1 OpLine`/`-g2 DebugLine` come only from `IRDebugLine` markers, placed per statement by `lowerStmt`→`maybeEmitDebugLine`; value insts fall under the last marker. Propagating `sourceLoc` onto re-synthesized value insts (`IRBuilderSourceLocRAII`) leaves `-g1/-g2/-g3` byte-identical; only diagnostics reading `inst->sourceLoc` see it, so without one the fix has no test — tell the maintainer ([statement markers](../learnings/1785275556385-slang-g2-debugline-is-statement-marker-driven-not-.md)).

**`-g2` FileCheck self-match.** The embedded source contains the CHECK lines, so a bare-word `CHECK-NOT` matches itself. Anchor on `%id = OpString "name"` (closing quote right after the name) and bind `DebugValue`→`DebugLocalVariable` through a captured id ([self-match](../learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md)).

## Producers of DebugSource, DebugFunction and DebugScope

**Constructors.** Synthesized `$init` ctors (#11550) get `DebugFunction`/`DebugScope` like user functions; suppressing only the scope leaves body `DebugLine`s (invalid NSDI), so gate on AST flavor (`SynthesizedDefault | SynthesizedMemberInit`) in lowering ([$init](../learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md)). A user `__init`'s `this` (#11565) is a synthesized local, not an `IRParam`: after `thisVar` is emitted (`slang-lower-to-ir.cpp:13839`), add a "this" name hint and an `IRDebugLocationDecoration` ([`this`](../learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md)).

**Name hints.** `ExtensionDecl` is anonymous, so `getNameForNameHint` uses the extended type's decl; hints also become HLSL/CUDA identifiers ([name hints](../learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md)).

**`IRDebugScope` arity.** 1 operand without `inlinedAt`, 2 with; a null operand crashes `buildEntryPointReferenceGraph` (`slang-ir-call-graph.cpp:~85`) ([arity](../learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md)).

**`-g2` + `import`/`#line` (#11982/#11983/#11984, distinct bugs)** are all producer-side in `slang-lower-to-ir.cpp` (consumer ~:2136 innocent); `-dump-ir` settles dedup, not DeepWiki. (1) An imported function's DebugFunction `parentScope` (operand 5) resolves to its own module's CU; see [[wiki/concepts/slang-backends-spirv-debug-function-info.md]]. (2) A duplicate `DebugSource` for one file comes from two producers spelling the path differently (`getMostUniqueIdentity()` relative vs `getName()` absolute), defeating `hoistable=true` dedup ([#11982](../learnings/1783466061131-slang-11982-duplicate-spir-v-debugsource-from-dive.md)). (3) A BOM in a `#line` file's `DebugSource` comes from `getOrEmitDebugSource`'s fresh-read fallback bypassing `SourceFile::setContents`'s BOM strip; decode in the fallback ([#11984](../learnings/1783468265984-slang-11984-g2-debugsource-for-line-files-bypasses.md)).

**Which modules' `DebugSource` and CU survive linking (#13982, PR #13992).** At `-g2`/`-g3` an imported module contributing nothing (or only an inlined `static const`) still emits a full-text `DebugSource` and an unreferenced CU. `linkIR` (`slang-ir-link.cpp:2356-2395`) deliberately (since PR #7203) clones every global `DebugSource`/`DebugBuildIdentifier`/CU of every user module; DCE keeps them (`mightHaveSideEffects` defaults true) and the emitter `ensureInst`s them all. Count references to each id in `spirv-asm` output [linker keeps all](../learnings/1793210647818-slang-spir-v-g-linker-keeps-debugsource-cu-of-ever.md).

Reachability is not ownership: `getOrEmitDebugSource` lazily creates in module M a `DebugSource` for any location M names, other modules' files included, with the owner's operands (hoistable dedup, PR #12034); a foreign `#include`d header record even has `isIncludedFile=true`. The fix records ownership at the producer: `generateIRForTranslationUnit` gives each CU the TU's `#include`d DebugSources as variadic operands; the linker clones a used module's CUs (bringing its full file list, code-less headers included per #7203) and clones foreign records only by reference. The emitter reads only `getSource()`, so extra operands are inert, but the IR meaning change needs a module-version bump (legacy-path test and gate drill: [[wiki/concepts/slang-compiler-serialization-and-enums.md]]). SPIR-V-only work configures `-DSLANG_ENABLE_DXIL=OFF` [ownership at producer](../learnings/1793220067281-slang-linker-a-module-s-debugsource-list-includes-.md).

## Debug type records

The emitter builds these itself, so it is their producer.

**`DebugTypeMatrix` for a col-major constant-buffer member (#12757)** emits `(vec2, 3, false)` instead of `(vec3, 2, true)`: the emit site (`slang-emit-spirv.cpp:11108-11138`) keys off source `getLayout()`, and `normalizeMatrixDebugType` (:10899) returns early for buffer types. The fix is layout-independent `(vec(getColumnCount()), getRowCount(), true)`; packing stays on the member decoration and `MatrixStride` (Slang's naming is reversed vs SPIR-V). PR #9708 (#9325) made it deliberate: get sign-off, update `tests/spirv/debug-matrix-layout.slang`, re-check `debug-matrix-layout-non-buffer.slang` ([matrix layout](../learnings/1787695833712-spir-v-debugtypematrix-keys-off-source-matrix-layo.md)).

**Opaque `DebugTypeComposite` (#12807).** The fallback (`:11241-11255`) emits `Size` as integer 0 instead of `DebugInfoNone` (ext-inst op 0, from a cached `getDebugInfoNone()` mirroring `getDwarfExpr()`) and reuses `name` as LinkageName (:11252). The requested `"@Texture2D"` is literal `"@"+Name`, not IR mangling (`getMangledTypeName` gives `_ST…`): check helper output against the expected text. The struct branch has the same LinkageName defect (maintainer's call) ([`"@"+Name`](../learnings/1787878146168-spir-v-debug-composite-issue-requested-name-linkag.md)).

## Debug variables for opaque handles (#12918, PR #12919)

Opaque resource/sampler locals lack debug info due to two upstream type gates: `isDebuggableType` (`slang-ir-insert-debug-value-store.cpp`; true by default only for `IRBasicType`; runs before `constructSSA`) and spirv-legalize's `isSimpleDataType` strip (`slang-ir-util.cpp:356`). The emitter is correct already (`emitDebugVarDeclaration`, `slang-emit-spirv.cpp:4676`, skips `OpDebugDeclare` without a backing var and binds via `OpDebugValue`). Fix rules:
- Admit texture/sampler leaves with a narrow predicate (not `isResourceType`, which unwraps arrays and matches buffers) at the leaf/creation sites, never in recursive `isDebuggableType`: `isAllowedDebugVarType` accepts structs, so a handle-holding struct would become an illegal Function `OpVariable`.
- `processDebugVar`'s strip is dead here (`emitDebugVar`, `slang-ir.cpp:3614/3619`, always builds a pointer-typed DebugVar); relax `processDebugValue` instead.
- `let x = t;` creates no `IRVar` (its debug info comes from the LetDecl case in `visitVarDecl`): test both `let` and `var`.
- Drop combined texture-sampler DebugValues (`isCombined()` → `OpTypeSampledImage`, an illegal operand) but keep arrays (`InputPatch`/`OutputPatch` are legal, `tests/spirv/tessellation`).
- `cleanUpVoidType`'s `argIndexRemap` uses all-params positions while earlier legalization strips empty params unremapped, so advancing per param breaks `debug-var-void-argument.slang`; flag ArgNumber remapping to the maintainer.

Sources: [two type gates](../learnings/1788744414687-slang-spir-v-opaque-resource-sampler-function-loca.md), [leaf gates, let-path](../learnings/1788748635093-slang-spir-v-opaque-handle-local-debug-info-fix-at.md), [operand limits, ArgNumber](../learnings/1789468940215-slang-spir-v-debug-var-value-operand-limits-param-.md).

## Debug variables across `-O` levels: `_dbgvar_` shadows and spirv-opt ADCE (#13841, #13842)

The `-O0`/`-O1` difference is spirv-opt's: the emitter ignores `-O`, IR dumps match, and spirv-opt runs only at `-O1`+ (slang-emit.cpp:3608) [`_dbgvar_` vars](../learnings/1792627978559-spir-v-g2-dbgvar-helper-vars-o0-duplicates-real-st.md). For a scalar local updated three times under `-g2`:

- **`-O0`:** each eligible local gets a `DebugDeclare` on a `_dbgvar_*` shadow `OpVariable` (`slang-emit-spirv.cpp:4781`), and each update emits an `OpDebugValue` plus an `OpStore` into it (`:11148-11185`), so a local with real storage is described twice.
- **`-O1`:** ADCE (`AddDebugValueForVariable`) finds the shadow dead and turns each whole-variable `OpStore` into another `DebugValue`: 3 updates become 6 (`spirv-opt --eliminate-dead-code-aggressive` reproduces it). `-O2`/`-O3` show none; struct members are spared.
- **Dynamically indexed updates** (`arr[tid] = v`) get no DebugValue (`translateIRAccessChain` rejects a non-constant index), so ADCE deletes the store-only shadow with its `DebugDeclare`, leaving a bare `DebugLocalVariable`. Same for any local keeping real storage (e.g. passed `inout` to a `[noinline]` function).
- **A `DebugDeclare` on real local storage survives** Slang's `-O1` pass list; verify by retargeting the `-O0` asm's `DebugDeclare` and running `spirv-as`, `spirv-opt -O` (or the `slang-glslang.cpp` list) and `spirv-dis` from `build/external/spirv-tools/tools/Debug/`.

spirv-val accepts all these forms, so count `DebugValue %var` per `DebugLocalVariable` [ADCE duplicates](../learnings/1792627232349-spir-v-debug-vars-spirv-opt-adce-duplicates-slang-.md). A fix pointing `DebugDeclare` at real storage matches the original `IRVar` (DebugLocation decoration), not the name (`eliminatePhis` temporaries share name hints: one `%i` served two loop `i`s); treats pointer-typed `inout`/`out` params as storage; and links via a decoration, since a DebugVar operand blocks `isPromotableVar` (slang-ir-ssa.cpp:513). "file too short" on a shared `build/Release` `libslang-compiler.so` means a sibling is relinking: wait, don't use a stale `build/Debug` [`_dbgvar_` vars](../learnings/1792627978559-spir-v-g2-dbgvar-helper-vars-o0-duplicates-real-st.md).

## The `DebugVarStorage` decoration (PR #13872, rejected) and IR `DebugDeclare` (PR #14114)

**The maintainer wants NSDI-shaped IR, not side-channel decorations.** On #13872 tangent-vector rejected `DebugVarStorage` as "a band-aid" with no NSDI/DWARF analog. His model: lowering emits a DebugVar plus IR `DebugDeclare(debugVar, storage)` for storage-backed bindings (DebugValue otherwise); every pass transforming an inst transforms its debug insts (SSA promotion drops the DebugDeclare and emits DebugValues; splitting splits them with access paths); debug IR stays ~1:1 with NSDI/DWARF/LLVM metadata so emit is trivial. On master (2026-10-30) `insertDebugValueStore` mirrors writes as DebugValues and the emitter invents the DebugDeclare on a `_dbgvar_` copy. He wants precise comment vocabulary ("pointer-typed IRParam") ([NSDI-shaped IR](../learnings/1793386932115-slang-debug-info-ir-maintainer-tangent-vector-want.md)). The decoration mechanics below apply equally to IR `DebugDeclare`.

PR #13872 (#13841) puts `[DebugVarStorage(%debugVar)]` on each `IRVar` and pointer-typed `out`/`inout` param. Unlike a DebugVar operand, a decoration does not block `isPromotableVar` and dies with the var, so its survival proves the storage's [entry-point param decoration](../learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md). A decoration naming a function-local inst breaks wherever params are moved or cloned:

- **Varying legalization moves entry-point params to globals.** `packStageInParameters` (Metal/WGSL) and `lowerOutParameters` replace them and transfer their decorations, so the DebugVar dangles at global scope and `-validate-ir` fails. Exclude entry points at the producer (`func->findDecoration<IREntryPointDecoration>()`).
- **legalize-types legalizes decoration operands** via `legalizeInst`; an operand legalizing to `none` (a zero-length array's DebugVar) hits `SLANG_UNEXPECTED("non-simple operand(s)!")`, so add `case kIROp_<YourDecoration>: return LegalVal();` to the args switch [same](../learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md).
- **Params-first cloners leave the decoration naming the original function's inst.** `slang-ir-clone.cpp` clones a block's children before its decorations, so same-block references resolve; a params-before-body cloner gets the old operand back from `findCloneForOperand` (as with the shared `IRDebugFunction`, [[wiki/concepts/slang-backends-spirv-debug-function-info.md]]). Known producers: `specializeGenericWithSetArgs` (~3924, dynamic-dispatch generics); forward-mode autodiff (`translateFuncParam` clones params first; remap via `cloneEnv.mapOldValToNew` after `translateFunc` and `generateTrivialFwdDiffFunc` [fwd-mode remap](../learnings/1792702942408-slang-vulkan-compare-compute-tests-compile-at-g2-a.md)); reverse mode's `splitApplyAndPropFuncs` and remat param-block clone (slang-ir-autodiff-unzip.cpp). Example: `void acc<T:IFoo>(T o, inout float a)` called with an existential at `-g2` names the generic's DebugVar and trips a release assert (slang-emit-spirv.cpp:4845). Fix: after the clone, remap each decoration operand with `findCloneForOperand(env, op)` and drop the decoration when no clone exists [params-first cloning](../learnings/1792708991560-cloning-a-function-s-params-before-its-first-block.md) [stale param decoration](../learnings/1792712281969-slang-ir-a-decoration-on-a-param-that-names-a-body.md).
- **Auditing:** check each `-dump-ir` pass section's `[DebugVarStorage(%x)]` against `%x = DebugVar(...)` (owning func, types), and sweep `tests/**/*.slang` at `-g2` (plus `-O0`, `-validate-ir-detailed`) with `xargs -P48` (~2 min) [same](../learnings/1792708991560-cloning-a-function-s-params-before-its-first-block.md). That sweep never hit dynamic dispatch, so it proves nothing about cloners; keep a consumer fallback with `-validate-ir` as the loud check, not a release assert (general rule: [[wiki/concepts/slang-compiler-crash-and-legalization-probes.md]]) [same](../learnings/1792712281969-slang-ir-a-decoration-on-a-param-that-names-a-body.md). In-param proxy vars (`IRInParamProxyVarDecoration`) are a separate storage case that DebugVar/DebugDeclare changes tend to miss [coverage drill](../learnings/1792692531156-coverage-drill-log-each-defensive-branch-to-a-file.md).

Stable IR ids collide among drafts (three claimed 910): check open PRs touching `slang-ir-insts-stable-names.lua`; take the next free id after rebase [same](../learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md).

**Substituting passes retarget an IR `DebugDeclare` onto non-pointer storage (PR #14114).** PR #14114 adds `DebugDeclare(debugVar, storage)` for `-g2`. Passes replacing a value via `cloneEnv`/`replaceUsesWith` ignore the declare, so it follows the replacement: `specializeFuncsForBufferLoadArgs` (`slang-ir-specialize-function-call.cpp:1052`) swaps a `__constref` param for the `ConstantBuffer` global; copy elimination does the same. Repro: `S s = cb; get(s)` with `[noinline] get(__constref S s, int)`; `-g2 -O0 -validate-ir` fails E40007 ("storage must have a pointer type"). Without `-validate-ir` the declare is dropped and an unwritten `_dbgvar_` backs the DebugVar: the debugger shows garbage. Find the pass via the first `-dump-ir` `### AFTER` section with `DebugDeclare(..., %cb)` in any function (here the specialized clone). In the test, split the literal so `-g2`'s embedded source cannot self-match: `%_dbgvar_{{x}} = OpVariable` ([E40007](../learnings/1793413639606-slang-ir-a-pass-that-substitutes-a-param-or-var-ca.md)).

## OpName and `spirv_asm` register names (#12002, #12108)

Every named `%id` register in a `spirv_asm` block gets an `OpName` at any debug level (the `idMap` loop in `slang-emit-spirv.cpp`). In #12002 a "misattributed OpName" was a stdlib collision: `hlsl.meta.slang` sample intrinsics named a register `%sampled`, so every sample emitted `OpName ... "sampled"` (a user call-result gets no `OpName`). Cosmetic; `slangc -target spirv-asm | grep OpName` reproduces it ([%sampled](../learnings/1783525064110-slang-12002-spirv-asm-named-registers-leak-into-op.md)). PR #12053 renamed it `%__sampled` at 94 sites with a `CHECK-NOT: "sampled"` test. A rename drill decides such claims (an OpName following a renamed user variable is propagation; one that stays is intrinsic-baked); lead the verdict with the refutation. Gating the auto-OpName loop is maintainer scope: it is a documented, tested feature (`tests/language-feature/spirv-asm/opname.slang`) and user OpNames are ungated too ([refute-then-fix](../learnings/1783746988745-slang-12002-shipped-refute-then-fix-triage-of-a-mi.md)).

The #12108 generalization (`hlsl.meta.slang` + `glsl.meta.slang`, 53 sites, plus a build assert) is maintainer-driven: stand down ([#12108 scope](../learnings/1784248363961-slang-12108-triage-spirv-asm-prefix-cleanup-scope-.md)). A file-wide sed is unsafe (`%result`/`%6` also appear in `__intrinsic_asm` LLVM/Metal strings): rename only inside brace-tracked `spirv_asm{}` ranges, skipping `$name`, integer ids and prefixed names. `slang-core-module-textures.cpp` (`writeGetDimensionFunctions`) is a second generator ([block-scoped rename](../learnings/1784760040459-renaming-spirv-asm-registers-in-meta-slang-block-s.md)).

## Stripping and the DebugEntryPoint string

**`-separate-debug-info` needs a `DebugBuildIdentifier` shim (#8681).** `stripDbgSpirvFromArtifact` hand-rolls the strip to keep the DBI (the hash linking the stripped module to its `.dbg.spv`). `CreateStripDebugInfoPass` and `CreateStripNonSemanticInfoPass` both delete it unconditionally, so use a hybrid: spirv-opt does the bulk strip and a thin Slang shim exempts or re-injects the DBI, its OpString and the NonSemantic import ([strip deletes DBI](../learnings/1783556986544-slang-8681-spirv-opt-strip-debug-deletes-debugbuil.md)).

**`DebugEntryPoint` command-line string (#12220)** has two independent bugs: `getDebugInfoCommandLineArgumentForEntryPoint` ends with a literal `sb << " -g2"` ignoring the requested level (an unused `getDebugInfoLevel()` exists), and `writeCommandLineArgs` is a `switch(option.key)` with no `default`, silently dropping un-cased options (`-lang`/`-profile`/`-gdwarf`/`-line-directive-mode` vanish; `-O0`/`-matrix-layout` survive). The string is stored verbatim (`strings x.spv`); `writeCommandLineArgs` also feeds CPU/LLVM emit but not the module-cache `buildHash` ([two bugs](../learnings/1784915879616-spir-v-debugentrypoint-command-line-string-two-roo.md)).

## See also

[[wiki/concepts/slang-backends-spirv.md]] · [[wiki/concepts/slang-backends-spirv-debug-function-info.md]] · [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]] · [[wiki/concepts/slang-backends-spirv-precise-and-nocontraction.md]] · [[wiki/concepts/slang-backends-spirv-capabilities-and-version-gating.md]] · [[wiki/concepts/slang-backends-spirv-descriptor-handles-and-heap.md]] · [[wiki/concepts/slang-backends-spirv-entry-points-varyings-and-execution-modes.md]] · [[wiki/concepts/slang-backends-spirv-emit-and-legalization-defects.md]] · [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]]

**Source learnings (35):**
- [-g0 doesn't zero debug info](../learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md)
- [-g0 emits exactly three records](../learnings/1784828289031-g0-debuginfolevel-none-emits-exactly-opsource-opna.md)
- [source embedding gated at two layers (#12181)](../learnings/1784666850986-slang-spir-v-source-text-embedding-is-gated-at-two.md)
- [two IRDebugSource producers (#12202)](../learnings/1784822669473-slang-debug-info-include-source-12181-12202-second.md)
- [bare fileless OpSource → 'unnamed' source](../learnings/1784851566899-slang-spir-v-emitting-a-bare-fileless-opsource-alo.md)
- [DebugLine only from statement markers](../learnings/1785275556385-slang-g2-debugline-is-statement-marker-driven-not-.md)
- [-g2 FileCheck self-match trap](../learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md)
- [synthesized $init ctors get debug info](../learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md)
- [user __init lacks `this`](../learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md)
- [getNameForNameHint; anonymous ExtensionDecl](../learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md)
- [DebugScope is variable-arity](../learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md)
- [#11982 duplicate DebugSource from path spelling](../learnings/1783466061131-slang-11982-duplicate-spir-v-debugsource-from-dive.md)
- [#11984 #line DebugSource bypasses BOM strip](../learnings/1783468265984-slang-11984-g2-debugsource-for-line-files-bypasses.md)
- [DebugTypeMatrix keys off source layout (#12757)](../learnings/1787695833712-spir-v-debugtypematrix-keys-off-source-matrix-layo.md)
- [opaque DebugTypeComposite (#12807)](../learnings/1787878146168-spir-v-debug-composite-issue-requested-name-linkag.md)
- [opaque handle locals: two type gates (#12918)](../learnings/1788744414687-slang-spir-v-opaque-resource-sampler-function-loca.md)
- [#12918 fix at leaf/creation gates](../learnings/1788748635093-slang-spir-v-opaque-handle-local-debug-info-fix-at.md)
- [debug-var operand limits, ArgNumber remap](../learnings/1789468940215-slang-spir-v-debug-var-value-operand-limits-param-.md)
- [#12002 spirv_asm registers leak into OpName](../learnings/1783525064110-slang-12002-spirv-asm-named-registers-leak-into-op.md)
- [#12002 refute-then-fix](../learnings/1783746988745-slang-12002-shipped-refute-then-fix-triage-of-a-mi.md)
- [#12108 scope: hlsl and glsl meta](../learnings/1784248363961-slang-12108-triage-spirv-asm-prefix-cleanup-scope-.md)
- [spirv_asm rename: block-scoped](../learnings/1784760040459-renaming-spirv-asm-registers-in-meta-slang-block-s.md)
- [#8681 strip-debug deletes DebugBuildIdentifier](../learnings/1783556986544-slang-8681-spirv-opt-strip-debug-deletes-debugbuil.md)
- [DebugEntryPoint string bugs (#12220)](../learnings/1784915879616-spir-v-debugentrypoint-command-line-string-two-roo.md)
- [ADCE duplicates DebugValue (#13842)](../learnings/1792627232349-spir-v-debug-vars-spirv-opt-adce-duplicates-slang-.md)
- [`_dbgvar_` vars across -O levels (#13841)](../learnings/1792627978559-spir-v-g2-dbgvar-helper-vars-o0-duplicates-real-st.md)
- [entry-point param decoration migrates](../learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md)
- [params-first cloning; audit sweep](../learnings/1792708991560-cloning-a-function-s-params-before-its-first-block.md)
- [param decoration goes stale](../learnings/1792712281969-slang-ir-a-decoration-on-a-param-that-names-a-body.md)
- [COMPARE_COMPUTE at -g2; fwd-mode remap](../learnings/1792702942408-slang-vulkan-compare-compute-tests-compile-at-g2-a.md)
- [coverage drill (in-param proxy vars)](../learnings/1792692531156-coverage-drill-log-each-defensive-branch-to-a-file.md)
- [linker keeps all DebugSource+CU (#13982)](../learnings/1793210647818-slang-spir-v-g-linker-keeps-debugsource-cu-of-ever.md)
- [DebugSource ownership needs the producer (PR #13992)](../learnings/1793220067281-slang-linker-a-module-s-debugsource-list-includes-.md)
- [maintainer wants NSDI-shaped debug IR (#13872)](../learnings/1793386932115-slang-debug-info-ir-maintainer-tangent-vector-want.md)
- [substituting passes retarget DebugDeclare (PR #14114)](../learnings/1793413639606-slang-ir-a-pass-that-substitutes-a-param-or-var-ca.md)
