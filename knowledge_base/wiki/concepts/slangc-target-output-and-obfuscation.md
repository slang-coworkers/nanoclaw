---
title: "slangc Target Output & Obfuscation"
type: concept
group: slang-tooling
tags: [targets, output, obfuscate, cuda, spirv, metal, slangpy, triage, reflection, falcor, vcpkg]
source_count: 14
---

# slangc Target Output & Obfuscation

This page covers what `slangc` actually writes per target and why output can be empty, wrong, or missing: the `-target hpp/cpp` "no output" crash and the library empty-output case; the absence of any Slang-source text target plus `-obfuscate`'s mangle-everything behavior; per-target emit-correctness traps (CUDA WMMA/coopmat, slangpy texture `[format]`, `-fvk-bind-globals` binding collisions); and the emit-verification + per-target triage playbooks used to diagnose all of the above (in-container SPIR-V, reflection-json, Falcor CI regressions, stale vcpkg builds, follow-up-refactor sequencing). Coverage/capability gating lives on [slangc Target Coverage & Capability Gating](slangc-target-coverage-and-capabilities.md); wave/VM/inliner backend mechanics live on [slangc Wave Intrinsics, VM Emitter & Inliner](slangc-wave-vm-and-inliner.md).

## TL;DR

- **`-target hpp/cpp` "no output file" is usually a SIGSEGV** from a graphics-stage (vertex/fragment) entry point (null `sourceLoc` in the varying-param legalizer), NOT a silent no-op — bisect by entry-point STAGE first.
- **A different empty output is not a crash:** `-target metal lib.slang` on a file with no `[shader]` entry point emits only `#include`s (reachability culling, not an optimizer pass — `-O0` doesn't change it). To emit a library you need BOTH `-whole-program` AND `public`/`export` roots.
- **No Slang-source text target** (`emit-slang.cpp` is a stub); `-obfuscate` mangles ALL linkage names incl. public/reflected → breaks `findParameterByName`. The IP-protection path is a precompiled `.slang-module`.
- **CUDA WMMA/coopmat emit is unconditional** but the prelude namespace is CUDA-12.5-guarded — gate `emitWMMAFragmentType` on `nvrtcVersion` or NVRTC <12.5 fails cryptically. CUDA prelude bugs ARE GPU-free reproducible (nvcc 12.6 installed, compile-only).
- **slangpy functional-API textures emit no `[format]`** → CUDA UNORM/SNORM writes silently corrupt (even post-#11090); slangpy must thread `self.format` onto the `value` field.
- **`-fvk-bind-globals <binding> <set>` with set≠0** collides a split-out sampler/texture onto the `$Globals` CB binding (flag path skips the shared-bucket +1 bump) — repro via `-target spirv-asm`.
- **Triage:** `slangc -emit-spirv-via-glsl` DOES run via direct slangc in-container (only the slang-test harness crashes); when glslang won't load, triage SPIR-V binding/layout via `-target spirv -O0 -reflection-json`; SPIR-V delta-checks need the `slang-glslang` target built. Bisect Falcor CI regressions by `merged_at` with an emit-diff arbiter; suspect a stale vcpkg 2024 build (`slangc -version`) when nothing reproduces; a follow-up-refactor's target code may live only on the still-open originating PR branch.

## `-target hpp/cpp` no-output: suspect a crash from graphics-stage entry points

When a user reports `slangc -target hpp` or `-target cpp` produces no output file, the likely cause is a SIGSEGV from a **graphics-stage** (vertex/fragment) entry point — not a silent no-op. `-o` writes nothing on crash and on Windows the crash dialog is easy to miss.

`hpp`/`cpp` are CPU/host-C++ targets. The varying-param legalizer (`slang-ir-legalize-varying-params.cpp:1048`) dereferences `m_param->sourceLoc` where `m_param` defaults to null and is only set in `processParam` — a graphics-result SV hits `diagnoseUnsupportedSystemVal` before the param loop runs. Compute entries have a `void` result and only compute SVs, so they never reach this path.

Triage shortcut: bisect by entry-point STAGE (compute vs vertex/fragment) before investigating other constructs. Fix layers: front-end diagnostic rejecting non-compute stages for CPU host-C++ targets + legalizer null-guard. ([slang -target hpp/cpp 'no output file' is usually a crash from a graphics-stage entry point](../learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md))

(Note the cross-check with the coverage page: the "front-end diagnostic" here must NOT become a broad stage rejection for CPU targets — graphics→CPU cross-compile is valid; the durable fix is the legalizer null-guard.)

A different "empty output" case is NOT a crash and NOT a bug: `slangc -target metal lib.slang -o lib.metal` on a file with no `[shader]` entry point emits only the `#include`s because Slang only emits code reachable from an entry point (reachability culling, not an optimizer pass — so `-O0` doesn't change it). To emit a library, BOTH are required: `-whole-program` (library mode) AND marking the functions to keep as `public`/`export` (which roots them against DCE — `-whole-program` alone still culls anything not reachable from a root). For cross-target (MSL+SPIR-V) library sharing, precompile to a `.slang-module` and `import` it per-target rather than emitting text and hand-splicing (`public __extern_cpp` keeps names unmangled if you must splice) ([Slang library code compiles to empty output without -whole-program + public](../learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md)).

## No Slang-source text target; `-obfuscate` mangles ALL linkage names

Slang cannot emit its own source, and cannot "minify/obfuscate-locals" a shader for shipping as source to a JIT client. Verified @ master 4d8fa2e9d (triaging #12313): (1) there is **NO Slang-source text target** — `source/slang/slang-emit-slang.cpp:6` (`emitSlangDeclarationsForEntryPoints`) is an empty stub (`SLANG_UNUSED(...); return SLANG_OK;`) and there is no `SLANG_SLANG_SOURCE` in the `CodeGenTarget` enum (`include/slang.h:683-728`); text output is HLSL/GLSL/Metal/WGSL/C/C++/CUDA only. (2) `-obfuscate` mangles **all** linkage names including public/reflected ones — `addLinkageDecoration` (`slang-lower-to-ir.cpp:1522-1540`) does `getHashedName(mangledName)` for EVERY non-core-module decl with no public/reflection carve-out, so it genuinely breaks `findParameterByName`. (3) The load-bearing architectural tension: renaming ONLY locals needs parsed+checked scope/visibility info that exists only AFTER preprocessing collapses source to one permutation, but preserving un-expanded `#if`/`#define` requires NOT preprocessing — you cannot have both in Slang's pipeline (text emit is post-IR at `slang-emit.cpp:2746`, so comments/whitespace/preprocessor/import are already gone). (4) A public/local boundary DOES exist if a source-emit path were ever built: `DeclVisibility{Private,Internal,Public}` (`slang-ast-support-types.h:1896`), `getDeclVisibility` (`slang-check-decl.cpp:21256`), `-no-mangle`→ExternCppModifier. (5) The intended path for the underlying IP-protection goal is a precompiled `.slang-module` binary IR (cf. closed #10065), whose blocker for #12313's OP is runtime preprocessor permutations. Triage disposition: feature-request/P2-P3 design proposal → PARK for maintainer scope decision, no fixer forward — candidates are either architecturally unsound or a large new emitter subsystem ([Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)](../learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md)).

## CUDA WMMA/coopmat: prelude namespace is CUDA 12.5-guarded, emit is not

`prelude/slang-cuda-prelude.h:6633-6634` guards the entire `Slang_CUDA_WMMA` namespace behind `#if CUDA 12.5+`. But `source/slang/slang-emit-cuda.cpp:1672-1718` emits `Slang_CUDA_WMMA::WmmaFragment<...>` unconditionally — no target-version gate. Under NVRTC < 12.5 the namespace body is empty, producing the cryptic NVRTC error "name followed by :: must be a class or namespace name." The principled fix: gate `emitWMMAFragmentType` on the target NVRTC version (queryable via `nvrtcVersion` in `slang-nvrtc-compiler.cpp:42`) and emit a clean diagnostic "cooperative-matrix requires NVRTC ≥ 12.5". General lesson: when a prelude feature is `#if`-version-guarded, the emitter that references it MUST gate on the same version or diagnose. ([Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded (NVRTC <12.5 fails cryptically) — #10689](../learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md))

CUDA prelude bugs (nvcc path) ARE locally reproducible GPU-free — `nvcc` 12.6 is installed at `/usr/local/cuda-12.6/bin/nvcc` with `cuda_fp16.h`/`cuda_bf16.h`/`cuda_fp8.h`, and compile-only (`nvcc -c ... -o /dev/null`) needs no GPU (so "CUDA lanes use NVRTC and miss this" doesn't block a repro). Recipe: copy `prelude/slang-cuda-prelude.h`, make a fixed copy, write a `.cu` that `#define`s the relevant `SLANG_CUDA_ENABLE_{HALF,BF16,FP8}` together and includes the prelude, then `nvcc -c` before/after and diff the error sets. Gotchas: always enable HALF whenever you enable BF16/FP8 (disabling HALF alone breaks `SLANG_MAKE_VECTOR` macro expansion — a false signal); CUDA 12.6 has a pre-existing `__half2` operator-redefinition clash present before AND after any fix, so grep the specific message rather than raw error counts to isolate your bug's delta. This upgrades a CUDA-prelude triage from "reasoned by inspection" to "reproduced + fix-verified" ([CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6](../learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md)).

## slangpy functional-API textures: no [format] decoration → CUDA UNORM writes corrupt

slangpy's generated RW accessor structs declare `RWTexture2D<T> value;` with no `[format(...)]` decoration. The CUDA compiler keys float→normalized-int conversion off `IRFormatDecoration`; without it, `inferImageFormatFromTextureType` infers float backing format → `_isConvertRequired=false` → no conversion emitted. UNORM/SNORM writes silently corrupt on CUDA. This persists even after upstream PR #11090 merges — #11090 improves the conversion lowering but still needs the format communicated via the decoration, which slangpy never emits. The companion slangpy change (threading `self.format` → `[format("…")]` onto the `RWTexture*Type<T>` `value` field) is genuinely required. ([slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md))

## `-fvk-bind-globals` non-default set collides split-out globals resources

With `-fvk-bind-globals <binding> <set>` where set != 0, a resource (sampler/texture) split out of the module-scope `uniform` globals struct is placed at the SAME (set, binding) as the `$Globals` UBO instead of globals-binding+1 → descriptor conflict (empirically confirmed via `-target spirv-asm -emit-spirv-directly`, grepping `OpDecorate Binding/DescriptorSet`; the trigger is the reservation path for ANY non-default set, not `set==1`). Root cause: the default path allocates the CB from `defaultSpace` on the same range-set the split-out sampler later allocates from (so it bumps to +1), but the flag path `_assignConstantBufferBinding` `.Add`s the reservation without the shared-bucket bump. No test coverage exists — add a `-target spirv-asm` FileCheck (no GPU needed). When a load-bearing binding/layout claim is disputed and a prebuilt slangc is available, REPRODUCE with a 2-minute emit rather than pick between competing subagent hypotheses ([fvk-bind-globals non-default set collides split-out globals resources onto CB binding (slang#10668)](../learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md)).

## In-container emit verification: `-emit-spirv-via-glsl`, reflection-json, slang-glslang

Correcting an earlier "glslang load fails in-container" note: `slangc -emit-spirv-via-glsl` **does** run in a freshly-built worktree via direct `slangc` — only the `slang-test` *harness* crashes at startup, not the compiler itself ([CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only the slang-test harness crashes)](../learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md), [-emit-spirv-via-glsl DOES run via direct slangc in a freshly-built worktree (corrects 'glslang load fails' learning)](../learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md)). When the local env genuinely can't load the glslang downstream (`spirv-opt`/`spirv-dis`/`slang-glslang-*` load failure) so `-target spirv-asm` aborts before writing output, triage SPIR-V **binding/layout** bugs with `-target spirv -O0 -reflection-json` — the reflection JSON exposes the binding decisions without needing the disassembler ([Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang downstream is unavailable](../learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md)).

Relatedly, SPIR-V delta-checks need the `slang-glslang` target built, not just `slangc`: `-target spirv`/`spirv-asm` with `SLANG_RUN_SPIRV_VALIDATION=1` loads downstream `spirv-opt`/`spirv-dis`/spirv-val from `libslang-glslang-<ver>.so`; building only `slangc` yields `error[E00100]: failed to load downstream compiler 'spirv-opt'` — a BUILD-SCOPE artifact, NOT a fix defect and NOT E38029 ([SPIR-V delta-check needs slang-glslang target, not just slangc](../learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md)).

## Falcor CI regression triage: bisect by merged_at, use emit diff as arbiter

Falcor CI runs against a pre-built Falcor with fresh Slang binaries copied on top. Falcor is fixed; only Slang changes between runs. A numeric regression LOOKS like Slang codegen, but:

- **Bisect by `merged_at` (not commit date).** shader-slang/slang merges via merge queue, so `author/commit date ≠ when it landed on master`. Use `gh pr view <n> --json mergedAt`. Confirm order with `git log --first-parent` + `git merge-base --is-ancestor A B`.
- **The decisive arbiter is a GPU-free emit diff.** Build slangc at the suspect's merge commit + parent, compile a minimal kernel to `-target hlsl` (fp16/`float16_t` needs `-profile sm_6_2`), diff. Byte-identical emit at a boundary EXONERATES that commit regardless of timing confusion.
- **Compute ULP magnitude first.** A few-ULP shift of an otherwise-correct value indicates too-tight tolerance, NOT a codegen bug.
- **Falcor test assertions and tolerances live in Falcor proper** — grep the slang tree → zero hits. D3D12-only + tiny-ULP + Vulkan-OK + externally-owned tolerance → environmental/driver cause stays live.

([CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](../learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md))

## vcpkg can silently pin a stale 2024 build

When a reporter's symptom reproduces on NO current version, suspect a stale/mismatched build early — before deep root-cause spelunking. Ask for `slangc -version` (actual runtime, not the package manifest version) in the first clarification. vcpkg/conan can pin or downgrade to an old build silently; a reporter's stated "2026.7.1" may be their actual 2024 binary. ([Slang triage: vcpkg can silently pin a stale (2024) build — ask `slangc -version` early when a symptom won't reproduce on any current version](../learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md))

## Follow-up refactor issues may target code not yet on master

When triaging a "follow-up from PR #X" refactor issue, verify where the target code lives before dispatching a fixer. The code to refactor may exist only on PR #X's still-open branch. Check: `git ls-files <paths>` on master + `gh api repos/<r>/pulls/<X> --jq '.merged,.state'`. If files are absent and the originating PR is open, the refactor is blocked on that merge — park it, don't dispatch. ([Follow-up refactor issues may target code not yet on master](../learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md))

---

**Source learnings (14):**
- [slang -target hpp/cpp "no output file" is usually a crash from a graphics-stage entry point](../learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md)
- [Slang library code compiles to empty output without -whole-program + public](../learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md)
- [Slang cannot minify/obfuscate-locals its own source text — no Slang-source target (emit-slang is a stub), -obfuscate mangles all names, text emit is post-preprocess (#12313)](../learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md)
- [Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded](../learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md)
- [CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6](../learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md)
- [slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)
- [CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](../learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md)
- [Slang triage: vcpkg can silently pin a stale (2024) build](../learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md)
- [CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only slang-test harness crashes)](../learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md)
- [-emit-spirv-via-glsl runs via direct slangc in a freshly-built worktree](../learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md)
- [Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang is unavailable](../learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md)
- [SPIR-V delta-check needs slang-glslang target, not just slangc](../learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md)
- [-fvk-bind-globals with set!=0 collides split-out globals resources onto the $Globals CB binding (#10668); flag path skips the shared-bucket +1 bump — repro via spirv-asm, no test coverage exists](../learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md)
- [Follow-up refactor issues may target code not yet on master](../learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md)

_Catalog: [[wiki/index.md]]_
