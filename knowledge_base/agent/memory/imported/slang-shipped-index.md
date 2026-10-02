---
name: slang-shipped-index
description: "Long-tail index of shipped / merged / reference chains kept for lookup only — no action pending. Split out of MEMORY.md to keep the root index scannable. Consult when a new report may duplicate past work or when re-verifying a landed fix."
metadata:
  node_type: memory
  type: index
  title: "Slang/SlangPy shipped and reference chains"
  originSessionId: unknown-prior-session
---

# Shipped / reference chains

No action pending on any entry here. These are kept for **lookup**: duplicate-detection on new reports, and re-verifying a landed fix when a regression is suspected. Live work lives in `MEMORY.md`; not-now-but-resumable work lives in [[slang-parked-index]].

## switch / control flow
- [#12236 pre-case unreachable](project_12236_switch_pre_case_unreachable.md) PR#12245 · [#12238 float switch cond → invalid SPIR-V](project_12238_float_switch_condition_invalid_spirv.md) PR#12246

## SPIR-V / debug-info
- ✅[#11983 DebugFunction wrong CU](project_11983_spirv_debugfunction_wrong_cu.md) #12148 MERGED 08-04 (`0864e60e635e`) — merged on one approval while we tracked it as `blocked`: `mergeable_state=blocked` names THAT a gate is unmet, never WHICH · [#12150 include/#line CU scoping](project_12150_include_line_cu_scoping.md) · [#12160 ForceUnroll + spirv-opt reassociation](project_12160_forceunroll_spirvopt_reassociation.md) GATED · [#12198 precise qualifier → NoContraction](project_12198_precise_qualifier_spirv_nocontraction.md) · [#12161 NonUniform DescriptorHandle](project_12161_nonuniform_descriptorhandle_nonspirv_verify.md) HELD · [#12257 CompilerOptionName serialization audit](project_12257_compileroptionname_serialization_audit.md)
- ✅[#12331 `-Os` spirv-opt size preset](project_12331_spirv_opt_size_preset_Os.md) — CLOSED 08-05 with our finding as the reason (`-O0 -Xspirv-opt -Os` already works); canonical home of the 3-armed `#elif` live-arm rule

## autodiff
- [#12210 property-getter frontend crash](project_12210_autodiff_property_getter_frontend_crash.md) #12232 · [#11075 IFloat generic minmax ICE](project_11075_ifloat_generic_minmax_vector_cpp_cuda_ice.md) #12249 · [#12071 bwd_diff loop vector divide](project_12071_bwddiff_loop_vector_divide_wrong_grads.md) · [#12136 load autodiff builtins on demand](project_12136_load_autodiff_builtins_on_demand.md) · [#11476 autodiff split gate](project_11476_autodiff_split_gate.md)

## bindless / descriptors / codegen
- [#12051 descriptor reuse pinning ✅#12111](project_12051_descriptor_reuse_pinning.md) LIVE #12120 · [#11568 direct-index ResourceDescriptorHeap](project_11568_descriptor_heap_direct_index.md) · ✅[#12185 spvBindlessTextureNV non-image DescriptorHandle](project_12185_bindless_texture_nv_desc_handle_nonimage.md) CLOSED completed (abandoned shapes: [history](project_12185_superseded_fix_shapes_history.md)) · [#12192 ConstantBuffer IR source-provenance](project_12192_e55215_constantbuffer_no_source_location.md) · [#12197 RayQuery by-value return NRVO](project_12197_rayquery_byvalue_return_nrvo.md) #12200
- [#9146 glslang stdlib re-export / LTO](project_9146_glslang_stdlib_reexport_lto.md) · [#12182 CUDA/OptiX callable RDC linkage](project_12182_cuda_optix_callable_rdc_linkage.md) → jkwak · [#12203 slang-test VulkanSDK path](project_12203_slang_test_vulkan_sdk_path.md)
- ✅[#12367 functype on kernel targets](project_12367_functype_kernel_emit_armed_cotrigger.md) PR #12378 MERGED 09-01 (E55216, interim) — spin-off #12372 (SPIR-V) still open

## CUDA/PTX
- ✅[#12277 half texture Load → undefined `tex*fetch_int<half>`](project_12277_cuda_ptx_half_texture_load_undefined_fetch.md) PR #12303 MERGED 08-03 (`757021dd00`) — interim E41400 diagnostic only; full half-texel fetch deferred to #10024, and `Sample`/`SampleLevel`/`Gather` keep the same unguarded half gap

## reflection / ABI
- [#12092 anyValueSize stride mismatch](project_12092_reflection_anyvaluesize_stride_mismatch.md) · [#12093 vector init-list coercion](project_12093_vector_initlist_coercion_inconsistency.md) — ⛔ resolved OPPOSITE to our recommendation: #12141 DISABLED the `(vec2,T)`/`(T,vec2)` vec4 initializers, so do NOT implement them · [#12089 HitObject SER ABI / NVAPI capability](project_12089_hitobject_ser_abi_nvapi_capability.md)

## stdlib capability annotations (`[require]`)
- ✅[#12165 `fwidth` unavailable in `fragment` for `metal`](project_12165_fwidth_metal_capability_annotation.md) PR #12172 MERGED 07-23 — vector/matrix overloads lacked the `metal` atom; defect-class sweep clean; `fwidth_coarse`/`fine` excluding metal is correct

## slangpy
- [spy#1051 = #12070 autodiff runtime loop start](project_slangpy_1051_slang_12070_autodiff_runtime_loop_start.md) · ⚠️[spy#1052 autograd cache grad-bit](project_slangpy_1052_autograd_cache_grad_bit.md) — **NOT shipped**: PR #1054 still draft, maintainer-gated · [spy#1055 diff loop + vector return](project_slangpy_1055_diff_loop_vector_return_wrong_grads.md) · [spy#1056 backward no-grad scatter crash](project_slangpy_1056_backward_nograd_scatter_crash.md) #1057 · [spy#1058 CUDA fast-math downstream args](project_slangpy_1058_cuda_fastmath_downstream_args.md) · [spy#1059 float3 CUDA perf](project_slangpy_1059_float3_cuda_perf.md) · ✅[spy#1067 macOS wheels](project_slangpy_1067_macos_wheels_pyframe_getlasti.md) #1068 MERGED 08-10 — coverage gap accepted, not closed (#1066) → [[feedback_merged_does_not_mean_the_flagged_gap_was_closed]] · [spy#1076 branch-protection review gate](project_slangpy_1076_branch_protection_review_gate.md) answered
- [spy#222 AMD atomic grad scatter](project_slangpy_222_amd_atomic_grad_scatter.md) — not shipped; upstream slang-rhi#834 + slang#12505 open

## CI flakes
- [#12137 aarch64 apt fetch](project_12137_aarch64_apt_fetch_ci_flake.md) · [#12145 GBufferRTTexGrads D3D12 access violation](project_12145_gbufferrttexgrads_d3d12_access_violation.md) · [#12214 replay timestamp dir race](project_12214_replay_timestamp_dir_race.md) · [#12074 sgl_tests teardown exitcode](project_12074_sgl_tests_teardown_exitcode_flake.md) · [#12116 DXC prebuilt zip 500](project_12116_dxc_prebuilt_zip_500_fetch_flake.md) (deferred-fatal `EXPECTED_HASH`; still unfixed)

## slang-rhi Metal
- ✅[rhi#801 native Metal buffer import](project_slang_rhi_801_metal_buffer_import.md) merged `11eefdc6` · ✅[rhi#800 Metal dispatchComputeIndirect](project_slang_rhi_800_metal_dispatch_indirect.md) merged `d8c609ef` (Devin's residency 🔴 not refuted) — [evidence & methods](project_slang_rhi_800_evidence_methods.md)
- 🔴 Canonical fact both chains had backwards: `m_hasResidencySet` is set only under `supportsFamily(MTL::GPUFamilyApple6)`; the hosted Paravirtual adapter lacks Apple6, so CI covers the **fallback** and the residency-set path is uncovered. Apple Silicon ≠ Apple6 — verify the predicate. Detail: `/workspace/shared/CANONICAL-ENV-FACTS.md`
- ✅[rhi#805 README/LICENSE MIT-vs-Apache](project_slang_rhi_805_license_readme_mismatch.md) #806 MERGED 08-03 — carries the ledger-verification and provenance lessons, incl. [squash breaks `merge-base --is-ancestor`](feedback_squash_merge_breaks_merge_base_ancestor_check.md)

## misc
- [GC resolve slice-worktree HEAD→PR](feedback_gc_resolve_slice_worktree_head_not_issue.md)
- ✅[#12238 / PR #12246 generic-selector over-rejection](project_12238_generic_selector_over_rejection.md) MERGED unchanged 08-04 — the approver ABSTAIN was a booked miss (severity ≠ existence)

⚠️ A terminal chain still needs its dup-detection row here — #12165 re-arrived 08-04 and cost a full re-verification because it had none.
