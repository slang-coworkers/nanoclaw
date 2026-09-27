---
name: slang-parked-index
description: "Long-tail index of chains that need no action now — parked, maintainer-owned, bot-unpushable, or merged/terminal. Split out of MEMORY.md to keep the root index scannable. One row per chain + its RESUME trigger; detail lives in each child topic file. Re-engage only on the stated RESUME trigger."
metadata: 
  node_type: memory
  type: index
  title: "Slang/SlangPy parked, held, and terminal chains"
  originSessionId: 7358aae4-41d9-4f9b-ba09-a17bc7230b74
---

# Parked / held / terminal chains

Everything here is **not actionable by me right now**. Each row names its RESUME trigger; the lessons and receipts live in the linked child file — **read the child before acting**. Topic files for terminal items stay on disk and are greppable by issue number even when not linked here. Retiring a row is a chain-state test, not a byte test: [[feedback_retirement_is_keyed_to_chain_state_not_bytes]] (terminal · detail in child · no orphan; fail any ⇒ shorten, never drop).

## Maintainer-owned, watch-only (no topic files)

#11746 · #11759 · #11806/7 · #11927 · #12035 · #12101 · #12113 · #12139 · #9062 diff-ptr-array · spy-samples#45 coopvec · spy-samples#46 tensor-migr · #12112 compile-perf

- [#12100 generic-nesting exponential compile](project_12100_generic_nesting_exponential_compile_parked.md) — CLOSED 08-05 as fixed-by-#12106 (verified: depth dependence removed on all 3 regression shapes). Guard proposal #12103 OPEN, 0/5 workloads. **RESUME:** #12103 gets a PR ⇒ check `generic_nesting_expr` + `cond_conformance_chain` are in it and the ladder clears depth 16. Instrument rules: [[technique_compile_perf_three_platforms_and_v_staleness]], [[feedback_a_claim_about_master_is_a_timestamp_not_a_version]].

## PENDING / HELD

#11528 shader_abort→rhi#781 · #11771 refl dup-global · #11780 simplifyIR #11779 · #11784 Conditional autodiff ICE · #10027 vec<T,4> import abort · #11732 groupshared VUID #8145 · #11709 gs byref #10641 · #11938 PathInfo leak · #11882 primal-require diff · #6319 dup sysval · #12183 refl cumul-offset · #9660 override/ext

## PARKED, RE-OPEN on fresh signal

#11669 GetDimensions WGSL/Metal · #11877 op-overload #12162 · #11963 mod-scope lambda · #11967 64-bit idx #11990 · #11903 HitObject sm69 #11907 · [#8125 empty-struct=dup #7612](project_7612_empty_cuda_struct_dedup_8125.md) fix PR #12304

## Bot-unpushable (needs maintainer PAT / workflows:write)

[#11988 nightly SpvOpt #12187](project_11988_nightly_spvopt_workflow_parked.md) jkwak · [#12062 board-sync 422](project_12062_board_sync_422_reviewer_node.md) APPROVED await jhelferty · [#12259 source-internal](project_12259_source_internal_team_source_field.md) jhelferty · [#12247 -O3 baseline](project_12247_slang_test_o3_spvopt_baseline.md) jkwak ~77benign+2real

See [[project_bot_workflows_permission]] for the permission gap itself.

## WOULD_APPROVE, awaiting merge

[#12080 __grid_const__](project_12080_grid_constant_pivot_false_safe.md) · [#12109 SpecWorkList](project_12109_specialization_work_list_scratchdata.md) · [#11545 ByteBuf chunker](project_11545_bytebuffer_alignment_chunker_stack.md) · [#9580 assoc-type-export](project_9580_glsl_legalize_layout_mismatch.md) — #12131 waits; jkwak DEFERRED ~2 sprints

## ✅ MERGED / CLOSED-TERMINAL

Topic files on disk, greppable by number. **Re-engage only on a fresh human (non-bot) comment.**

#12273 · #12265 · spy#1081 · #12244 · #12260 · #12285 · #12286 · #12268 · #12069 · spy#782 · spy#1072 · #12095 · #12219→#12263 · #12279→#12290 · #12270 · #12278→#12300 · #12276→#12288 · spy#1082 · spy#1075 · ⚠️#12226 CB-bindless→StorageBuf **RE-OPEN if unresolved** · [#12223→#12324](project_12223_debug_build_og_debuggability.md) our #12234 closed unmerged, skiminki's #12324 MERGED ⇒ #12223 auto-closed; NOTHING RESUMES (lessons in child: squash ⇒ never `--is-ancestor`; approval state is never read from a comments endpoint)

## Misc long-tail pointers

[#10675 Metal uniform-ptr](project_10675_metal_uniform_pointer_indirection.md) · [#9400 loadSerialized dep-src](project_9400_loadserialized_dep_source_redundant.md) · [spy#1074 onboard dashboard](project_slangpy_1074_onboard_pr_dashboard.md) jhelferty · [#12258 MetalLib 3.2 Win](project_12258_metallib_3_2_windows.md) residual `-std` bump · [#12222 lexer UTF-8 byte](project_12222_lexer_lone_utf8_continuation_byte.md) RESUME=PR · [#12284 overload silent-break](project_12284_cross_module_overload_silent_break_warning.md) rec A; RESUME=PR · slang-llvm Win (jkwak; caveat=re-roll): [#12283 JIT COFF](project_12283_llvm_jit_coff_ordered_sections_windows.md) · [#12292 gfx-smoke unload](project_12292_gfx_smoke_slang_llvm_unload_crash.md)

## Held drafts / terminal-awaiting-human

Each carries a topic file with its RESUME trigger. None actionable now.

- [#6434 `nthsetbit` intrinsic](project_6434_nthsetbit_intrinsic_scrub.md) — scrub answered 08-05 (cmt `5196133459`), cited gist never used the API ⇒ ergonomics ask; Approach A design-settled, not staged. RESUME=`jkiviluoto-nv` decides or `natevm` confirms.
- [rhi#807 disable metallib_4_0](project_slang_rhi_807_disable_metallib_4_0.md) — MERGED before our ABSTAIN ⇒ shadow; guard deleted ⇒ that regression is now CI-silent.
- 🔴 [#11225 E36121 cap-vs-target](project_11225_capability_target_incompat_slangpy_break.md) — **RE-OPENED 08-05, not dormant** (row kept for reachability): DRAFT spy#1088 fix verified + APPROVED; its green CI cannot observe the fix. RESUME=promote/merge spy#1088.
- [#11118 Atomic\<T\> \[mutating\]](project_11118_atomic_mutating_noncopyable_spirv.md) DELTA POSTED, pending human · [#12302 vendored license-attrib](project_12302_cmark_vendored_license_attribution.md) PLAN done, HELD-no-PR
- [#12311 (T)float-lit floors](project_12311_generic_float_literal_cast_floors.md) P1 DRAFT #12312 TERMINAL HELD · [#12298 enum:bool case-label](project_12298_enum_bool_switch_canonicalization.md) P3 DRAFT #12301 HELD OP-gated · [#12157 IR ver-bump #12158](project_12157_ir_version_check_required_status.md) CLOSED both sides 08-04; F1 partial (workflow push refused server-side), RESUME=**jkwak** applies the workflow diff · [#11944 SV_Target #11945](project_11944_sv_target_location_order.md) · [#10668 -fvk-bind-globals](project_10668_fvk_bind_globals_set_binding_conflict.md) FIX AUTH-C draft-only · [#10584 SV_Barycentrics cap](project_10584_svbarycentric_capability_check.md) draft #10666
- [#11631 \[require\] SPIR-V caps](project_11631_entrypoint_require_spirv_codegen.md) SHIPPED DRAFT #11633 · [#12196 bindless](project_12196_require_bindless_texture_codegen.md) PARK · [#12316 type-layout dup](project_12316_type_layout_policy_duplication_techdebt.md) tech-debt PARK · [#9153 public-by-default](project_9153_public_by_default_structs.md) Prop 1 LV-2026 · [#9999 switch w/o cases](project_9999_switch_without_cases_diagnostic_fork.md) SEP HELD
- Own-bot echoes, 0 dispatch, PARKED, **not regressions**: [#12320 coverage-macos segv](project_12320_coverage_macos_segfault_base_rate.md) — human owner `jkiviluoto-nv`; our ~17% was a ~3× undercount, corrected in place to a bracket (≥7 segv / ≤18 attempt-1 fails) because the step retries once and a green night can hide the crash; needs workflow-YAML + actions-write ⇒ not ours · [#12321 bf16 vec→float4 -vk](project_12321_bfloat16_vector_vulkan_wrong_lanes.md) CI-claim disproved ⇒ driver-specific L40S.

## ⚠️ HELD but with LIVE issues (spilled from MEMORY.md 2026-08-04)

Maintainer-gated, not closed. Re-read the child before acting.

- ⚠️ [#12110 NonUniformResourceIndex on DescriptorHandle](project_12110_nonuniform_descriptorhandle_spirv.md) — PR #12116 COMMENTED, no APPROVE. RESUME v3 needs all three: non-bot · addressed to us · changes a load-bearing input (or merge). See also [[project_12110_nonuniform_descriptorhandle_fixed_in_1415]].
- ⚠️ [#11981 Metal whole-program out/inout addrspace](project_11981_metal_export_out_param_addrspace.md) — draft #12014 stale ⇒ unowned live chain; only `report_pr_created(12014)` still owed. RESUME=fixer calls it, or nudge jkwak.
- 🔁 [nanoclaw kb-sync `pr_ready_for_review` = NO-OP](project_nanoclaw_kb_sync_pr_autoref_noop.md) — nightly bot snapshot, self-merges in seconds, no approver for that repo; match on title+author+base, never head branch; re-verify the PII scrub per instance (repo is public).
- ✅ [nanoclaw#1064 tasks group-scope lookup](project_nanoclaw_1064_tasks_group_scope_lookup_bug.md) — MERGED `fcb39e4f` 08-04; RESUME discharged 08-04T10:40Z (bare `ncl tasks list` now returns the series). No dispatch: no approver wired for the nanoclaw repo.
- ✅ [nanoclaw#1065 reclaim before wake](project_nanoclaw_1065_reclaim_before_wake.md) — MERGED `aef98dd4` 08-04; no dispatch (no approver, no review bot). Its regression test does not pin the fix (execution-confirmed differential); producer-side gap left open.
