---
title: "Slang wave ops across element types and targets: bool gaps, WaveMatch lane masks, control columns and self-checking GPU probes"
type: concept
group: slang-backends
tags: [wave-ops, subgroup, bool, WaveActiveBit, WaveMultiPrefixBit, WaveMaskPrefixBitXor, WaveMatch, WaveMaskMatch, __match_any_sync, OpGroupNonUniformLogical, OpGroupNonUniformPartitionNV, ElementTypeTrait, cuda, spirv, dxc, wgsl, sweep, control-column, self-check-probe, filecheck, merge-tree, E36107, E40009]
source_count: 6
---

# Slang wave ops across element types and targets

Slang's wave intrinsics (`hlsl.meta.slang`) dispatch per target through `__target_switch`: HLSL calls the DXC intrinsic, SPIR-V emits `OpGroupNonUniform*`, CUDA goes through the prelude's `_wave*` helpers and `ElementTypeTrait`, and WGSL maps to `subgroup*`. Each leg has its own element-type rules, so a type that works on one target can fail to compile, fail validation, or silently compute the wrong answer on another. This page records the gaps found in the 2026-11 wave-op work (#14249, #14251, #14255, #14263, #14273) and the test methods that found them. Capability gating in general is on [[wiki/concepts/slangc-target-coverage-and-capabilities.md]]; CUDA active-mask synthesis is on [[wiki/concepts/slang-backends-cuda-active-mask-and-ballots.md]].

## TL;DR

- **Every wave-op type sweep needs a known-good control column** (for example `uint2`). Failures that also hit the control are capability or version noise (E36107, glslang "requires SPIR-V 1.3"), not element-type bugs.
- **Bool is a four-backend gap.** CUDA's prelude `ElementTypeTrait` needs `bool` and `bool1..4`; SPIR-V bitwise wave ops need `OpGroupNonUniformLogical*` for bool (choose with `__isBool<T>()`); DXC `WaveActiveBit*` takes only uint/uint64 while `WaveMultiPrefixBit*` converts bool; WGSL `subgroupAnd/Or/Xor`, broadcast, shuffle and `quadSwap` reject bool, and only `subgroupAll/Any/Ballot` accept it.
- **A Vulkan GPU row does not prove a SPIR-V bool fix.** The NVIDIA driver runs invalid `OpGroupNonUniformBitwiseAnd %bool` and returns the right answer. Pin the opcode with a `-target spirv` FileCheck or compile under `SLANG_RUN_SPIRV_VALIDATION=1`.
- **Lane-mask tests need non-uniform per-lane values and must check every `uint4` component.** Uniform input makes the all-equal and the partition intrinsics agree, and a scalar→`uint4` splat copies `.x` into `.yzw`.
- **Self-checking probes find semantic bugs that compile sweeps miss:** make the lane value a pure function of the lane id, have each lane brute-force its partition's answer, and OR per-family failure bits into a buffer.
- **Build edge values from bit patterns** (`asdouble(lo, hi)`, `asfloat(0x7fc00000u)`). An unsuffixed Slang literal is `float`, so `1.0e300` warns E40009 and becomes Inf.
- **When a fix unblocks compilation for a family of functions, value-test every newly reachable entry point** (scalar, vector and matrix overloads). If a sibling PR owns a small identical fix on that path, carry it and check both merge orders with `git merge-tree --write-tree`.
- **When the prelude and the IR-op emit path disagree, the emit path may already be right.** Compare them before writing a new lowering.
- **FileCheck: a `-NOT` before a `-DAG` group checks only the text before the first DAG match.** Ban an opcode from the whole output with a separate SIMPLE run and its own prefix, and prove it with a negative control.

## Sweeping wave intrinsics across element types and targets

A sweep of wave intrinsics × element types × targets compiles each case to SPIR-V (under `SLANG_RUN_SPIRV_VALIDATION=1`), DXIL through DXC and PTX through NVRTC; generating one shader per (function, type) and running the downstream compiler is the method on [[wiki/concepts/slangc-target-coverage-and-capabilities.md]]. That sweep (#14249) is what first exposed `WaveActiveBit*(bool)` emitting `OpGroupNonUniformBitwise*` on bool and the missing CUDA `ElementTypeTrait<boolN>` ([per-function sweep beats first-error E36107](../learnings/1793734049922-per-function-sweep-beats-first-error-e36107-for-gl.md)). Add a known-good control type column: after the #14255 fix, 70 failures remained, and every one also failed for the `uint2` control (E36107 capability errors and glslang SPIR-V-version or extension errors). Without the control they look like bool bugs ([wave-op type sweeps need a control column](../learnings/1793741038958-wave-op-type-sweeps-need-a-control-column-bool-gap.md)).

Before keeping a fix for a side bug the sweep finds, check sibling dispatches and draft PRs. The vector `WaveMaskPrefixBitXor`→`WaveMultiPrefixBitOr` bug found in #14255 was already #14250 / PR #14254 ([control column; check sibling PRs](../learnings/1793741038958-wave-op-type-sweeps-need-a-control-column-bool-gap.md)).

## Bool on wave ops, backend by backend

- **CUDA.** The prelude `ElementTypeTrait` needs `bool` and `bool1..4`, scalar bool included, because the `Quad*` reads go through `_waveShuffleMultiple`. Without it NVRTC reports "incomplete type".
- **SPIR-V.** `OpGroupNonUniformBitwise*` is invalid on `OpTypeBool`; bool needs `OpGroupNonUniformLogical*`, chosen with `if (__isBool<T>())` in the spirv case, as `WavePrefixBit*` already did. The NVIDIA Vulkan driver runs the invalid bitwise form and returns the right answer, so COMPARE_COMPUTE `-vk` rows pass on master too ([VK runtime rows don't discriminate](../learnings/1793744564384-wave-op-bool-fixes-vk-runtime-rows-don-t-discrimin.md)); the general rule is on [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]].
- **DXC 1.9.** `WaveActiveBitAnd/Or/Xor` accepts only uint and uint64 (it rejects int too) and fails bool with "no known conversion from 'const bool' to 'unsigned int'". `WaveMultiPrefixBit*` takes `any_int`, converts bool implicitly and lowers to `@dx.op.waveMultiPrefixOp.i32`. So only `WaveActiveBit*` (and `WaveMaskBit*` on HLSL) needs a bool→uint reroute ([DXC bool rules](../learnings/1793744564384-wave-op-bool-fixes-vk-runtime-rows-don-t-discrimin.md), [DXC unsigned-only](../learnings/1793741038958-wave-op-type-sweeps-need-a-control-column-bool-gap.md)).
- **WGSL.** `subgroupAnd/Or/Xor`, `subgroupBroadcast`, `subgroupShuffle` and `quadSwap*` all reject bool (spec §17.12–13); only `subgroupAll`, `subgroupAny` and `subgroupBallot` accept it.

In a generic core-module function, the vector bool→uint conversion that type-checks is `vector<uint,N>(__slang_noop_cast<vector<bool,N>>(x))`: `__intCast` accepts scalars only, and `vector<uint,N>(vector<T,N>)` fails for a generic `T` ([control column; bool gaps](../learnings/1793741038958-wave-op-type-sweeps-need-a-control-column-bool-gap.md)).

To ban an opcode in FileCheck, do not put a `-NOT` line before a `-DAG` group: it checks only the text before the first DAG match. Use a separate SIMPLE run with its own prefix (`X: OpEntryPoint`, then `X-NOT: OpGroupNonUniformBitwise`) and check with a negative control that it fails when the opcode is present.

## WaveMatch and lane-mask tests

The CUDA prelude `_waveMatchScalar`/`_waveMatchMultiple` used `__match_all_sync`, the all-equal predicate (full mask when the value is uniform, 0 otherwise). `WaveMatch` needs the per-lane partition, `__match_any_sync`. A uniform test value passes under both, so lane-mask tests need lanes with different values, such as `lane % 2` (Vulkan prints 0x55/0xAA). A second bug hid behind the first: CUDA `WaveMatch` returns `WaveMaskMatch(...)` (a `uint`) as `uint4`, and Slang's scalar→vector conversion copies the value into every component, so `.y/.z/.w` equal `.x`; it was invisible only while the result was 0. Check `.y|.z|.w == 0` in every `uint4` lane-mask test. The `kIROp_WaveMaskMatch` case in `slang-emit-cuda.cpp` already emitted `__match_any_sync`; only the prelude disagreed (the general prelude-vs-emitter drift rule is on [[wiki/concepts/slang-b-bindings-and-backends.md]]). For raw GPU output run `slang-test -bindir $PWD/build/Debug/bin render-test <file> -cuda -compute -shaderobj -o out.txt`; render-test is `librender-test-tool.so`, not a standalone binary ([CUDA WaveMatch: non-uniform values and .yzw](../learnings/1793745788116-cuda-wavematch-test-with-non-uniform-values-and-ch.md)).

With valid inputs, CUDA `__match_any_sync` and Vulkan `OpGroupNonUniformPartitionNV` both compare bitwise: +0 and −0 fall in different partitions, and NaNs with the same bits match. Build such edge values from bit patterns. An unsuffixed literal such as `1.0e300` is a `float` literal in Slang; out of range it warns E40009 ("floating-point literal unrepresentable") and becomes Inf (`OpConstant %double 0x1p+1024`), so `double(x) * 1.0e300` yields Inf or NaN and produced a false CUDA-vs-Vulkan difference in #14273. The matrix `WaveMaskMatch` overload (hlsl.meta.slang ~17617) is broken off CUDA: it has no spirv case (E36107), and its glsl case emits `subgroupPartitionNV(mat2x2)`, which glslang rejects. For a cross-target matrix control use `WaveMatch(matrix).x`, which loops over rows on GLSL and SPIR-V ([float literals overflow silently; matrix WaveMaskMatch](../learnings/1793748746270-wave-op-gpu-probes-slang-float-literals-overflow-s.md)). The same note records that on small PRs (under ~20 changed compiler lines) Reviewer A and Reviewer C finish in about 16 and 9 minutes; if the head moves mid-review, check `<run_dir>/exit-status` before killing a run.

## Self-checking value probes

A compile sweep proves only that code compiles; wrong results need a GPU run. A self-checking probe makes the per-lane value a pure function `valueOf(lane)`, so each lane computes the reduction or prefix over its own partition by brute force, without wave reads, compares it with the intrinsic, and `InterlockedOr`s a per-family failure bit into a small buffer. Run it on 32 lanes with even/odd and irregular partition masks. On #14255 it found that vector `WaveMaskPrefixBitXor` calls `WaveMultiPrefixBitOr` (fixed in #14254); on CUDA, vector `WavePrefixBitXor` routes through that overload. The probe is at `/workspace/agent/runs/probe-14255/selfcheck/` ([self-check probe](../learnings/1793744564384-wave-op-bool-fixes-vk-runtime-rows-don-t-discrimin.md)).

## Unblocking compilation can expose a latent wrong result

Adding CUDA `ElementTypeTrait<bool2..4>` in #14255 fixed the NVRTC errors for bool vector wave ops, and it also made `WavePrefixBitXor(bool2)` compile. That call goes through `WaveMaskPrefixBitXor`, whose copy-paste bug calls `WaveMultiPrefixBitOr`, so the PR turned a compile error into a silently wrong result. The PR's test checked prefix Xor only on a scalar, to stay independent of sibling PR #14254, and the peer reviewer caught it. When a fix unblocks a family of functions, give every newly reachable entry point a runtime value test (vector and matrix overloads too), even when a sibling PR owns a bug on that path. If the sibling's fix is a small identical hunk, carry it, and check with `git merge-tree --write-tree A B` that the branches merge cleanly in both orders, so neither order ships a wrong result. `git merge-tree` fails silently on a remote ref that was never fetched; fetch with an explicit refspec (`git fetch origin br:refs/remotes/origin/br`) before trusting a "conflict" result ([unblocking a path can expose a latent wrong-result bug](../learnings/1793750162625-making-an-uncompilable-path-compile-can-expose-a-l.md)).

## See also

- [[wiki/concepts/slangc-target-coverage-and-capabilities.md]] — per-function sweeps, E36107 stacking, downstream-compiler checks
- [[wiki/concepts/slang-backends-cuda-active-mask-and-ballots.md]] — CUDA active-mask synthesis and ballot groups
- [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]] — why a Vulkan GPU row does not prove SPIR-V validity
- [[wiki/concepts/slang-backends-f0909b0-spirv-varyings-pointers-waveops.md]] — wave/ballot CSE on SPIR-V
- [[wiki/concepts/slangc-target-output-and-obfuscation.md]] — running DXC locally (pass-through, `SLANG_ENABLE_DXIL=OFF` builds)

**Source learnings (6):**
- [wave-op type sweeps need a control column; bool gaps span CUDA trait, SPIR-V Logical ops, DXC unsigned-only, WGSL (#14251)](../learnings/1793741038958-wave-op-type-sweeps-need-a-control-column-bool-gap.md) — generic bool→uint cast; FileCheck `-NOT` before `-DAG`; check sibling PRs
- [wave-op bool fixes: VK runtime rows don't discriminate; DXC bool rules per op; self-check probe (#14255)](../learnings/1793744564384-wave-op-bool-fixes-vk-runtime-rows-don-t-discrimin.md) — `WaveMultiPrefixBit*` lowers to `.i32`; DXC pass-through
- [CUDA WaveMatch: `__match_all_sync` → `__match_any_sync`; uniform input and the `uint4` splat hide both bugs (#14273)](../learnings/1793745788116-cuda-wavematch-test-with-non-uniform-values-and-ch.md) — emit path already right; render-test raw output
- [wave-op GPU probes: Slang float literals overflow silently to Inf (E40009); matrix `WaveMaskMatch` broken off CUDA](../learnings/1793748746270-wave-op-gpu-probes-slang-float-literals-overflow-s.md) — bitwise partition compare; review run timing
- [making an uncompilable path compile can expose a latent wrong result; test every op you unblock (#14255)](../learnings/1793750162625-making-an-uncompilable-path-compile-can-expose-a-l.md) — carry sibling fix; `git merge-tree` both orders
- [per-function sweep found `WaveActiveBit*(bool)` on SPIR-V and CUDA `ElementTypeTrait<boolN>` (#14249)](../learnings/1793734049922-per-function-sweep-beats-first-error-e36107-for-gl.md) — sweep method on the coverage page

_Catalog: [[wiki/index.md]]_
