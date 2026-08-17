---
title: "slangc Targets, Emit/Codegen Traps & Triage"
type: concept
group: slang-tooling
tags: [targets, emit, codegen, cuda, spirv, metal, vm, slangi, capability, triage, reflection]
source_count: 26
---

# slangc Targets, Emit/Codegen Traps & Triage

This page covers `slangc` target coverage and its limitations, backend emit/codegen traps (VM bytecode, inliner, empty-struct fields, CUDA prelude, wave intrinsics, empty output), and per-target triage playbooks (CPU-kernel no-output crashes, Falcor CI regressions, stale vcpkg builds, in-container SPIR-V verification). The CLI-invocation, freshness, doc-CI, and FileCheck-harness mechanics live on the sibling page [slangc CLI, Freshness & Emit-Verification Mechanics](slang-tooling-slangc-cli-targets.md).

## TL;DR

- **`hasOption(Optimization)` is TRUE by default** and `getOptimizationLevel()` returns `Default` (not `None`) for an ordinary compile — NOT an explicit-request signal. For explicit opt-in, gate on `shouldRunSPIRVValidation` (validation is off unless `SLANG_RUN_SPIRV_VALIDATION`).
- **Gate IR passes on target FAMILY** (`isCUDATarget`/`isMetalTarget`/`isSPIRV`/`isD3DTarget` from `slang-target.h`), NOT `getTargetCaps().implies(compound_alias)` — a single-family target can never imply a multi-family alias, and cap sets are minimal/on-demand at early passes.
- **Coverage-instrument gate ≠ atomic64 capability** — Metal/cpp pass the coverage gate but lack 64-bit atomics; cross-check the `atomic64` capdef alias membership AND per-emitter handling.
- **CPU-kernel targets (`cpp`/`hpp`):** do NOT add a front-end stage rejection — graphics→CPU cross-compile is valid input. `-target hpp/cpp` "no output" is usually a SIGSEGV from a graphics-stage entry point (null `sourceLoc` in the varying-param legalizer). A different empty output (metal lib with no entry point) is reachability culling — needs `-whole-program` AND `public`/`export`.
- **No Slang-source text target** (`emit-slang.cpp` is a stub); `-obfuscate` mangles ALL linkage names incl. public/reflected → breaks `findParameterByName`. IP-protection path is a precompiled `.slang-module`.
- **Backend emit traps:** wave intrinsics have NO IR opcode (stdlib `[ForceInline]` only); the slangi VM emitter needs every `IRConstant` op case writing exactly `sizeAlignment.size` bytes (add a `default: SLANG_UNEXPECTED`); empty-struct field skip must be an IR transform, not an emit-layer skip; CUDA WMMA emit is unconditional but the prelude namespace is CUDA-12.5-guarded (gate on `nvrtcVersion`); slangpy textures emit no `[format]` → CUDA UNORM writes corrupt.
- **Triage:** bisect Falcor CI regressions by `merged_at` with an emit-diff arbiter; suspect a stale vcpkg-pinned build (ask `slangc -version`) when nothing reproduces; `slangc -emit-spirv-via-glsl` DOES run in-container (only the slang-test harness crashes) — else triage binding bugs via `-target spirv -O0 -reflection-json`. nvcc 12.6 is installed for GPU-free CUDA-prelude repros.

## Target coverage: `hasOption(Optimization)` is NOT an explicit-request signal

`hasOption(CompilerOptionName::Optimization)` is **true by default** — the COM `getEntryPointCode` path materializes the Optimization option for every compile. `getOptimizationLevel()` also returns `OptimizationLevel::Default` (not `None`) for an ordinary compile. Any warning or branch gated on this combination fires on every ordinary `-target spirv` compile.

A reliable explicit-opt-in signal: SPIR-V validation is off by default and enabled only via `SLANG_RUN_SPIRV_VALIDATION`. Gate diagnostics on `shouldRunSPIRVValidation(codeGenContext)` instead. ([hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](wiki/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md))

## Target coverage: coverage instrumentation vs atomic64 capability

The `isCoverageInstrumentationTargetSupported` gate in `slang-ir-coverage-instrument.cpp` only skips WGPU and CPU-via-LLVM — it does NOT track per-target atomic capability. Metal and the `cpp` source target pass the gate but do NOT support 64-bit atomics: the `atomic64` capability alias in `slang-capabilities.capdef` covers `GL_EXT_shader_atomic_int64 | _sm_6_6 | cpp | cuda` but excludes Metal/WGSL, and the cpp AtomicAdd emitter (`slang-emit-cpp.cpp:1355-1389`) is 32-bit-only. Before asserting backend support for any atomic/width change, cross-check the capdef alias membership AND the per-emitter handling. ([Slang coverage target-support gate ≠ atomic64 capability membership](wiki/learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md))

## Target family gating vs CapabilitySet::implies

`targetRequest->getTargetCaps().implies(compound_alias)` is the WRONG test for "can this target lower feature X" in early IR passes:

- `implies(multiTarget)` returns NotImplied for any family the target lacks: "x implies (c|d) only if (x implies c) AND (x implies d)". A single-family target (e.g. `-target spirv`) can never imply a multi-family alias.
- Target cap sets are minimal at early stages — extension atoms are added ON DEMAND at emit, so they are absent at an early post-link IR pass.

Use target-family helpers from `slang-target.h`: `isCUDATarget`, `isMetalTarget`, `isSPIRV(...)`, `isD3DTarget(...)`, plus `targetRequest->getOptionSet().getProfileVersion()` for the HLSL shader-model boundary. ([Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias); late-synthesize stdlib intrinsics via KnownBuiltin](wiki/learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md))

## Front-end stage rejection for CPU targets: do not add one

Do NOT add a `validateEntryPoint` rejection of non-compute pipeline stages on CPU kernel targets (`cpp`, `hpp`, `host-callable`, etc.). Graphics-stage entry points compiling to CPU kernel targets is **valid input** exercised by `tests/render/cross-compile-entry-point.slang` and related cross-compile tests. The legalizer (`slang-ir-legalize-varying-params.cpp`) handles vertex/fragment varyings when they are representable. There is no front-end signal distinguishing an entry point the legalizer can lower from one it cannot — that is a per-shape decision inside the legalizer.

The correct fix for CPU-legalizer crashes is a null-safe source location in the legalizer, not a front-end stage/target gate. ([Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](wiki/learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md))

## -target hpp/cpp no-output: suspect a crash from graphics-stage entry points

When a user reports `slangc -target hpp` or `-target cpp` produces no output file, the likely cause is a SIGSEGV from a **graphics-stage** (vertex/fragment) entry point — not a silent no-op. `-o` writes nothing on crash and on Windows the crash dialog is easy to miss.

`hpp`/`cpp` are CPU/host-C++ targets. The varying-param legalizer (`slang-ir-legalize-varying-params.cpp:1048`) dereferences `m_param->sourceLoc` where `m_param` defaults to null and is only set in `processParam` — a graphics-result SV hits `diagnoseUnsupportedSystemVal` before the param loop runs. Compute entries have a `void` result and only compute SVs, so they never reach this path.

Triage shortcut: bisect by entry-point STAGE (compute vs vertex/fragment) before investigating other constructs. Fix layers: front-end diagnostic rejecting non-compute stages for CPU host-C++ targets + legalizer null-guard. ([slang -target hpp/cpp 'no output file' is usually a crash from a graphics-stage entry point](wiki/learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md))

A different "empty output" case is NOT a crash and NOT a bug: `slangc -target metal lib.slang -o lib.metal` on a file with no `[shader]` entry point emits only the `#include`s because Slang only emits code reachable from an entry point (reachability culling, not an optimizer pass — so `-O0` doesn't change it). To emit a library, BOTH are required: `-whole-program` (library mode) AND marking the functions to keep as `public`/`export` (which roots them against DCE — `-whole-program` alone still culls anything not reachable from a root). For cross-target (MSL+SPIR-V) library sharing, precompile to a `.slang-module` and `import` it per-target rather than emitting text and hand-splicing (`public __extern_cpp` keeps names unmangled if you must splice) ([Slang library code compiles to empty output without -whole-program + public](wiki/learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md)).

## No Slang-source text target; -obfuscate mangles ALL linkage names

Slang cannot emit its own source, and cannot "minify/obfuscate-locals" a shader for shipping as source to a JIT client. Verified @ master 4d8fa2e9d (triaging #12313): (1) there is **NO Slang-source text target** — `source/slang/slang-emit-slang.cpp:6` (`emitSlangDeclarationsForEntryPoints`) is an empty stub (`SLANG_UNUSED(...); return SLANG_OK;`) and there is no `SLANG_SLANG_SOURCE` in the `CodeGenTarget` enum (`include/slang.h:683-728`); text output is HLSL/GLSL/Metal/WGSL/C/C++/CUDA only. (2) `-obfuscate` mangles **all** linkage names including public/reflected ones — `addLinkageDecoration` (`slang-lower-to-ir.cpp:1522-1540`) does `getHashedName(mangledName)` for EVERY non-core-module decl with no public/reflection carve-out, so it genuinely breaks `findParameterByName`. (3) The load-bearing architectural tension: renaming ONLY locals needs parsed+checked scope/visibility info that exists only AFTER preprocessing collapses source to one permutation, but preserving un-expanded `#if`/`#define` requires NOT preprocessing — you cannot have both in Slang's pipeline (text emit is post-IR at `slang-emit.cpp:2746`, so comments/whitespace/preprocessor/import are already gone). (4) A public/local boundary DOES exist if a source-emit path were ever built: `DeclVisibility{Private,Internal,Public}` (`slang-ast-support-types.h:1896`), `getDeclVisibility` (`slang-check-decl.cpp:21256`), `-no-mangle`→ExternCppModifier. (5) The intended path for the underlying IP-protection goal is a precompiled `.slang-module` binary IR (cf. closed #10065), whose blocker for #12313's OP is runtime preprocessor permutations. Triage disposition: feature-request/P2-P3 design proposal → PARK for maintainer scope decision, no fixer forward — candidates are either architecturally unsound or a large new emitter subsystem ([Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)](wiki/learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md)).

## Wave intrinsics: no IR opcode, stdlib ForceInline only

`WaveActiveSum`, `WaveActiveCountBits`, `WaveIsFirstLane` have **no `kIROp_*` opcode and no IRBuilder emit helper**. They are stdlib `[ForceInline]` functions in `source/slang/hlsl.meta.slang` with `__target_switch` bodies that expand to per-target source/asm.

The only wave-ish IR opcodes that exist: `kIROp_WaveGetActiveMask`, `kIROp_WaveMaskBallot`, `kIROp_WaveMaskMatch`, `kIROp_WaveSizeDecoration`.

An IR pass that wants to inject a wave reduction must either: (A) synthesize `IRCall`s to the linked stdlib wave funcs by mangled name (uses `KnownBuiltin` registry, requires force-keep conditional on target capability), or (B) add new IR ops + per-target emit in every `slang-emit-*.cpp`. Option A is lighter but untested late — spike with `-target spirv` + `-target cuda` and confirm wave ops + caps appear. ([Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](wiki/learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md))

## slangi VM emitter: missing IRConstant cases, constant-section contract

`ByteCodeEmitter::addConstantValue(IRConstant*)` in `source/slang/slang-emit-vm.cpp` dispatches on `inst->getOp()` with no `default:` arm. A missing case (e.g. `kIROp_BoolLit` was absent) reserves the operand's `offset`/`size` before the switch writes the actual bytes — then appends zero bytes. The next constant overlaps, and `validateOperandAccess` (slang-vm.cpp) trips OOB at runtime.

Contract: each switch arm must append exactly `sizeAlignment.size` bytes (from `getNaturalSizeAndAlignment`) to `constantSection`. For `IRBoolLit`, `bool`'s natural size is 4 bytes on common targets; writing one byte reproduces the OOB. The correct pattern mirrors `IntLit`: cast to `int64_t`, `addRange` using `sizeAlignment.size`.

Add a `default: SLANG_UNEXPECTED("unhandled IRConstant op in VM emitter");` defensive arm so the next missing op fails at emit time rather than as a VM crash. Current op coverage: `StringLit`, `IntLit`, `FloatLit`, `PtrLit`, `BoolLit`, `VoidLit`. ([slangi VM emitter: missing IRConstant cases produce silent malformed operands](wiki/learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md), [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](wiki/learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md), [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](wiki/learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md))

## Inliner: DebugNoScope after ForceInline callee (entry scope not in IR)

With `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee to caller code emits `DebugNoScope` instead of restoring the caller fn's `DebugScope`. Root cause: `emitCalleeDebugInlinedAt()` (`source/slang/slang-ir-inline.cpp:336-428`) restores the caller scope by scanning backward for an enclosing `IRDebugScope` — if none found, it emits `DebugNoScope`. A top-level caller's own entry `DebugScope` is **not materialized in the IR**; it is synthesized at emit time in `slang-emit-spirv.cpp:4139-4190`. So the backward scan finds nothing and produces spurious `DebugNoScope`. ([slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](wiki/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md))

## Empty-struct field emit-skip: must be an IR transform, not emit-layer skip

Skipping empty-struct field *declarations* in `CLikeSourceEmitter::emitStructDeclarationsBlock` fixes the crash but introduces a regression: `MakeStruct` construction and `FieldExtract`/`FieldAddress` accesses still reference the omitted member → downstream compile failure `no member named 'e_1'`. The emit-only fix appears to work at default-opt (optimizer folds empty-field reads) but fails under `-cpu` COMPARE_COMPUTE which compiles with LLVM at `-g3`.

The correct fix is a guaranteed IR transform (opt-level-independent): remove empty struct fields in IR AND rewrite all their uses — `FieldExtract` → `emitDefaultConstruct`, `FieldAddress` → address of a fresh local, `trimMakeStructOperands` + `removeStoresIntoField`. Gate the transform by `shouldLegalizeExistentialAndResourceTypes`, not a literal target check. ([Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](wiki/learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md))

## CUDA WMMA/coopmat: prelude namespace is CUDA 12.5-guarded, emit is not

`prelude/slang-cuda-prelude.h:6633-6634` guards the entire `Slang_CUDA_WMMA` namespace behind `#if CUDA 12.5+`. But `source/slang/slang-emit-cuda.cpp:1672-1718` emits `Slang_CUDA_WMMA::WmmaFragment<...>` unconditionally — no target-version gate. Under NVRTC < 12.5 the namespace body is empty, producing the cryptic NVRTC error "name followed by :: must be a class or namespace name." The principled fix: gate `emitWMMAFragmentType` on the target NVRTC version (queryable via `nvrtcVersion` in `slang-nvrtc-compiler.cpp:42`) and emit a clean diagnostic "cooperative-matrix requires NVRTC ≥ 12.5". General lesson: when a prelude feature is `#if`-version-guarded, the emitter that references it MUST gate on the same version or diagnose. ([Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded (NVRTC <12.5 fails cryptically) — #10689](wiki/learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md))

CUDA prelude bugs (nvcc path) ARE locally reproducible GPU-free — `nvcc` 12.6 is installed at `/usr/local/cuda-12.6/bin/nvcc` with `cuda_fp16.h`/`cuda_bf16.h`/`cuda_fp8.h`, and compile-only (`nvcc -c ... -o /dev/null`) needs no GPU (so "CUDA lanes use NVRTC and miss this" doesn't block a repro). Recipe: copy `prelude/slang-cuda-prelude.h`, make a fixed copy, write a `.cu` that `#define`s the relevant `SLANG_CUDA_ENABLE_{HALF,BF16,FP8}` together and includes the prelude, then `nvcc -c` before/after and diff the error sets. Gotchas: always enable HALF whenever you enable BF16/FP8 (disabling HALF alone breaks `SLANG_MAKE_VECTOR` macro expansion — a false signal); CUDA 12.6 has a pre-existing `__half2` operator-redefinition clash present before AND after any fix, so grep the specific message rather than raw error counts to isolate your bug's delta. This upgrades a CUDA-prelude triage from "reasoned by inspection" to "reproduced + fix-verified" ([CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6](wiki/learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md)).

## slangpy functional-API textures: no [format] decoration → CUDA UNORM writes corrupt

slangpy's generated RW accessor structs declare `RWTexture2D<T> value;` with no `[format(...)]` decoration. The CUDA compiler keys float→normalized-int conversion off `IRFormatDecoration`; without it, `inferImageFormatFromTextureType` infers float backing format → `_isConvertRequired=false` → no conversion emitted. UNORM/SNORM writes silently corrupt on CUDA. This persists even after upstream PR #11090 merges — #11090 improves the conversion lowering but still needs the format communicated via the decoration, which slangpy never emits. The companion slangpy change (threading `self.format` → `[format("…")]` onto the `RWTexture*Type<T>` `value` field) is genuinely required. ([slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](wiki/learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md))

## Follow-up refactor issues may target code not yet on master

When triaging a "follow-up from PR #X" refactor issue, verify where the target code lives before dispatching a fixer. The code to refactor may exist only on PR #X's still-open branch. Check: `git ls-files <paths>` on master + `gh api repos/<r>/pulls/<X> --jq '.merged,.state'`. If files are absent and the originating PR is open, the refactor is blocked on that merge — park it, don't dispatch. ([Follow-up refactor issues may target code not yet on master](wiki/learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md))

## Falcor CI regression triage: bisect by merged_at, use emit diff as arbiter

Falcor CI runs against a pre-built Falcor with fresh Slang binaries copied on top. Falcor is fixed; only Slang changes between runs. A numeric regression LOOKS like Slang codegen, but:

- **Bisect by `merged_at` (not commit date).** shader-slang/slang merges via merge queue, so `author/commit date ≠ when it landed on master`. Use `gh pr view <n> --json mergedAt`. Confirm order with `git log --first-parent` + `git merge-base --is-ancestor A B`.
- **The decisive arbiter is a GPU-free emit diff.** Build slangc at the suspect's merge commit + parent, compile a minimal kernel to `-target hlsl` (fp16/`float16_t` needs `-profile sm_6_2`), diff. Byte-identical emit at a boundary EXONERATES that commit regardless of timing confusion.
- **Compute ULP magnitude first.** A few-ULP shift of an otherwise-correct value indicates too-tight tolerance, NOT a codegen bug.
- **Falcor test assertions and tolerances live in Falcor proper** — grep the slang tree → zero hits. D3D12-only + tiny-ULP + Vulkan-OK + externally-owned tolerance → environmental/driver cause stays live.

([CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](wiki/learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md))

## vcpkg can silently pin a stale 2024 build

When a reporter's symptom reproduces on NO current version, suspect a stale/mismatched build early — before deep root-cause spelunking. Ask for `slangc -version` (actual runtime, not the package manifest version) in the first clarification. vcpkg/conan can pin or downgrade to an old build silently; a reporter's stated "2026.7.1" may be their actual 2024 binary. ([Slang triage: vcpkg can silently pin a stale (2024) build — ask `slangc -version` early when a symptom won't reproduce on any current version](wiki/learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md))

## In-container slangc: -emit-spirv-via-glsl DOES run; use reflection-json for binding triage

Correcting an earlier "glslang load fails in-container" note: `slangc -emit-spirv-via-glsl` **does** run in a freshly-built worktree via direct `slangc` — only the `slang-test` *harness* crashes at startup, not the compiler itself ([CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only the slang-test harness crashes)](wiki/learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md), [-emit-spirv-via-glsl DOES run via direct slangc in a freshly-built worktree (corrects 'glslang load fails' learning)](wiki/learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md)). When the local env genuinely can't load the glslang downstream (`spirv-opt`/`spirv-dis`/`slang-glslang-*` load failure) so `-target spirv-asm` aborts before writing output, triage SPIR-V **binding/layout** bugs with `-target spirv -O0 -reflection-json` — the reflection JSON exposes the binding decisions without needing the disassembler ([Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang downstream is unavailable](wiki/learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md)).

## slangc -h advertises glsl_110..140 profiles the parser rejects

`slangc -profile glsl_140` → `E00014 unknown profile`, yet `slangc -h` lists `glsl_{110,120,130,140}` as accepted (#11898). The advertised-vs-accepted profile lists are out of sync across three sites; fixing it also trips the `check-cmdline-ref` CI (regenerate the reference) ([1782980898198-slangc-h-advertises-glsl-110-120-130-1](wiki/learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md)).

## slang-wasm bindings expose NO compiler-option surface

**Verified at HEAD 8e3f9163d (2026-07-15).** The Slang WASM/JS bindings do **not** let a JS caller pass compiler options like `-allow-glsl` — `createSession` takes only an int target. ([slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)](wiki/learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md))

---
## SPIR-V Delta-Checks Need the slang-glslang Target (2026-07-14 fold)

`-target spirv`/`spirv-asm` with `SLANG_RUN_SPIRV_VALIDATION=1` loads downstream `spirv-opt`/`spirv-dis`/spirv-val from `libslang-glslang-<ver>.so`; building only `slangc` yields `error[E00100]: failed to load downstream compiler 'spirv-opt'` — a BUILD-SCOPE artifact, NOT a fix defect and NOT E38029 ([SPIR-V delta-check needs slang-glslang target, not just slangc](wiki/learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md)).

## -fvk-bind-globals Non-Default Set Collides Split-Out Globals Resources (2026-07-23 fold)

With `-fvk-bind-globals <binding> <set>` where set != 0, a resource (sampler/texture) split out of the module-scope `uniform` globals struct is placed at the SAME (set, binding) as the `$Globals` UBO instead of globals-binding+1 → descriptor conflict (empirically confirmed via `-target spirv-asm -emit-spirv-directly`, grepping `OpDecorate Binding/DescriptorSet`; the trigger is the reservation path for ANY non-default set, not `set==1`). Root cause: the default path allocates the CB from `defaultSpace` on the same range-set the split-out sampler later allocates from (so it bumps to +1), but the flag path `_assignConstantBufferBinding` `.Add`s the reservation without the shared-bucket bump. No test coverage exists — add a `-target spirv-asm` FileCheck (no GPU needed). When a load-bearing binding/layout claim is disputed and a prebuilt slangc is available, REPRODUCE with a 2-minute emit rather than pick between competing subagent hypotheses ([fvk-bind-globals non-default set collides split-out globals resources onto CB binding (slang#10668)](wiki/learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md)).

**Source learnings (26):**
- [Slang cannot minify/obfuscate-locals its own source text — no Slang-source target (emit-slang is a stub), -obfuscate mangles all names, text emit is post-preprocess (#12313)](wiki/learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md)
- [slangi VM emitter: missing IRConstant cases produce silent malformed operands](wiki/learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md)
- [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](wiki/learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md)
- [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](wiki/learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md)
- [Slang coverage target-support gate ≠ atomic64 capability membership](wiki/learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md)
- [Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](wiki/learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md)
- [Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias)](wiki/learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md)
- [slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](wiki/learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)
- [CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](wiki/learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md)
- [slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](wiki/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md)
- [Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded](wiki/learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md)
- [Follow-up refactor issues may target code not yet on master](wiki/learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md)
- [Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](wiki/learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md)
- [slang -target hpp/cpp "no output file" is usually a crash from a graphics-stage entry point](wiki/learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md)
- [Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](wiki/learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md)
- [hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](wiki/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md)
- [Slang triage: vcpkg can silently pin a stale (2024) build](wiki/learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md)
- [CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only slang-test harness crashes)](wiki/learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md)
- [-emit-spirv-via-glsl runs via direct slangc in a freshly-built worktree](wiki/learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md)
- [Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang is unavailable](wiki/learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md)
- [slangc -h advertises glsl_110/120/130/140 profiles the parser rejects (three-site sync + check-cmdline-ref CI)](wiki/learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md)
- [Slang library code compiles to empty output without -whole-program + public](wiki/learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md)
- [CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6](wiki/learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md)
- [SPIR-V delta-check needs slang-glslang target, not just slangc](wiki/learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md)
- [slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)](wiki/learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md)
- [-fvk-bind-globals with set!=0 collides split-out globals resources onto the $Globals CB binding (#10668); flag path skips the shared-bucket +1 bump — repro via spirv-asm, no test coverage exists](wiki/learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md)

_Catalog: [[wiki/index.md]]_
