---
name: ""
description: "Long-tail index of chains that need no action now — parked, maintainer-owned, bot-unpushable, or merged/terminal. Split out of MEMORY.md to keep the root index scannable. Re-engage only on the stated RESUME trigger."
metadata: 
  node_type: memory
  type: index
  title: "Slang/SlangPy parked, held, and terminal chains"
  originSessionId: 7358aae4-41d9-4f9b-ba09-a17bc7230b74
---

# Parked / held / terminal chains

Everything here is **not actionable by me right now**. Each entry names its RESUME trigger. Topic files for terminal items stay on disk and are greppable by issue number even when not linked here.

## Maintainer-owned, watch-only (no topic files)

#11746 · #11759 · #11806/7 · #11927 · #12035 · #12100 · #12101 · #12113 · #12139 · #9062 diff-ptr-array · spy-samples#45 coopvec · spy-samples#46 tensor-migr · #12112 compile-perf

## PENDING / HELD

#11528 shader_abort→rhi#781 · #11771 refl dup-global · #11780 simplifyIR #11779 · #11784 Conditional autodiff ICE · #10027 vec<T,4> import abort · #11732 groupshared VUID #8145 · #11709 gs byref #10641 · #11938 PathInfo leak · #11882 primal-require diff · #6319 dup sysval · #12183 refl cumul-offset · #9660 override/ext

- [#12223 `-Og` Debug build](project_12223_debug_build_og_debuggability.md) — our #12234 **CLOSED UNMERGED** → skiminki's #12324 carries the direction. ⚠️**live tripwire: his `Fixes #12233` is a 1-digit TYPO ⇒ #12223 will NOT auto-close** → flag it when #12324 merges. ⭐**direction adopted ≠ our SHAPE accepted.** Housekeeping: reap branch `fix/issue-12223`. RESUME = #12324 merges (then flag the typo) .
- [#12331 `-Os` spirv-opt size preset](project_12331_spirv_opt_size_preset_Os.md) — jkwak self-filed + self-assigned ⇒ **advisory, no PR**. TRIAGED; cmt `5170076786` patched correct. `-Xspirv-opt -Os` already reaches `RegisterSizePasses` (#12204/#12206 shipped the mechanism) ⇒ the "feature" is ergonomics + a supported name. 🔑`#elif 1`@:344 ships as `-O1`; `#else`@:384-446 is DEAD, rejected over **driver breakage** (:352-353) ⇒ open Q4 = *"does that breakage still apply to current drivers?"*. ⚠️`-Os` collides with the GCC `Default→-Os` mapping. **RESUME (answer OR act — he SELF-ASSIGNED, so his natural move is a commit, not a reply):** (1) he **answers** a design question / asks for Approach A ⇒ build the harness extension (size metric + preset axis, shared with #9192, driver-compat first); **(2) he ACTS** — a PR touching the preset `switch` in `slang-glslang.cpp`, the `-O` name table, a new `SLANG_OPTIMIZATION_LEVEL_*`, **`tools/compile-perf/`**, or #12331 closing ⇒ **re-read the merged diff**, then re-verify the **2 PERISHABLE claims** holding up comment `5170076786`, because a stale one makes it a confidently-wrong PUBLIC artifact: **P1** `-Xspirv-opt -Os` reaches `RegisterSizePasses()` *with zero code change* — re-check ✅`grep -cF -e '"s,size"' source/core/slang-type-text-util.cpp` + `grep -cF -e 'OPTIMIZATION_LEVEL_SIZE' include/slang.h`, **both 0 = holds** (⛔not "re-read the passthrough" or "re-run slangc" — both survive a first-class `-Os` ⇒ non-discriminating, and I hold no clone) · **P2** `compile-perf` records time but **never** artifact size — ⛔**an ABSENCE-check needs ARMING: `grep -r` from the wrong cwd prints nothing at exit 2, identical to a genuine zero at exit 1 ⇒ reads as a PASS while never having looked.** Use the armed form in the chain note (`cd`-guard + `test -d` + a `find … | wc -l` control ⇒ prints **CANNOT VERIFY** instead of a false pass); ⛔never `**.py` (skips subdirs). ⚠️**I hold no slang clone ⇒ this reports CANNOT VERIFY for me; the zero-hit baseline is the TRIAGER's measurement, not mine — 📌**`0 size-probes of 16 .py files scanned`; keep the DENOMINATOR, since `0/0` (wrong cwd) reads identically to `0/16`****. The `#elif`-arm + GCC-collision facts are DURABLE by contrast; (3) #9192 moves ⇒ shared-harness question reopens there. ⛔advisory: no PR, never close it myself.

## PARKED, RE-OPEN on fresh signal

#11669 GetDimensions WGSL/Metal · #11877 op-overload #12162 · #11963 mod-scope lambda · #11967 64-bit idx #11990 · #11903 HitObject sm69 #11907 · [#8125 empty-struct=dup #7612](project_7612_empty_cuda_struct_dedup_8125.md) fix PR #12304

## Bot-unpushable (needs maintainer PAT / workflows:write)

[#11988 nightly SpvOpt #12187](project_11988_nightly_spvopt_workflow_parked.md) jkwak · [#12062 board-sync 422](project_12062_board_sync_422_reviewer_node.md) APPROVED await jhelferty · [#12259 source-internal](project_12259_source_internal_team_source_field.md) jhelferty · [#12247 -O3 baseline](project_12247_slang_test_o3_spvopt_baseline.md) jkwak ~77benign+2real

See [[project_bot_workflows_permission]] for the permission gap itself.

## WOULD_APPROVE, awaiting merge

[#12080 __grid_const__](project_12080_grid_constant_pivot_false_safe.md) · [#12109 SpecWorkList](project_12109_specialization_work_list_scratchdata.md) · [#11545 ByteBuf chunker](project_11545_bytebuffer_alignment_chunker_stack.md) · [#9580 assoc-type-export](project_9580_glsl_legalize_layout_mismatch.md) — #12131 waits; jkwak DEFERRED ~2 sprints

## ✅ MERGED / CLOSED-TERMINAL

Topic files on disk, greppable by number. **Re-engage only on a fresh human (non-bot) comment.**

#12273 · #12265 · spy#1081 · #12244 · #12260 · #12285 · #12286 · #12268 · #12069 · spy#782 · spy#1072 · #12095 · #12219→#12263 · #12279→#12290 · #12270 · #12278→#12300 · #12276→#12288 · spy#1082 · spy#1075 · ⚠️#12226 CB-bindless→StorageBuf **RE-OPEN if unresolved**

## Misc long-tail pointers

[#10675 Metal uniform-ptr](project_10675_metal_uniform_pointer_indirection.md) · [#9400 loadSerialized dep-src](project_9400_loadserialized_dep_source_redundant.md) · [spy#1074 onboard dashboard](project_slangpy_1074_onboard_pr_dashboard.md) jhelferty · [#12258 MetalLib 3.2 Win](project_12258_metallib_3_2_windows.md) residual `-std` bump · [#12222 lexer UTF-8 byte](project_12222_lexer_lone_utf8_continuation_byte.md) RESUME=PR · [#12284 overload silent-break](project_12284_cross_module_overload_silent_break_warning.md) rec A; RESUME=PR · slang-llvm Win (jkwak; caveat=re-roll): [#12283 JIT COFF](project_12283_llvm_jit_coff_ordered_sections_windows.md) · [#12292 gfx-smoke unload](project_12292_gfx_smoke_slang_llvm_unload_crash.md)

## Held drafts / terminal-awaiting-human (moved out of MEMORY.md 08-03 to keep the root index scannable)

Each carries a topic file; RESUME trigger named there. None actionable now.

- [rhi#807 disable metallib_4_0](project_slang_rhi_807_disable_metallib_4_0.md) — MERGED before our ABSTAIN ⇒ shadow; guard DELETED ⇒ that regression is now **CI-silent**
- [#11225 E36121 cap-vs-target](project_11225_capability_target_incompat_slangpy_break.md) — DRAFT spy#1088 FIX VERIFIED + `skallweitNV` APPROVED@head + CI 13✅; `true`-arm caveat CLOSED by Win CI; TERMINAL maintainer-owned, RESUME=promote/merge. ⚠️holds the **sign-INVERTED** non-discriminating-signal lesson ⇒ control must be *"could this have come out differently?"*, never a blocklist of known-bad patterns
- [#11118 Atomic\<T\> \[mutating\]](project_11118_atomic_mutating_noncopyable_spirv.md) DELTA POSTED, pending human · [#12302 vendored license-attrib](project_12302_cmark_vendored_license_attribution.md) PLAN done, HELD-no-PR
- [#12311 (T)float-lit floors](project_12311_generic_float_literal_cast_floors.md) P1 DRAFT #12312 TERMINAL HELD · [#12298 enum:bool case-label](project_12298_enum_bool_switch_canonicalization.md) P3 DRAFT #12301 HELD OP-gated · [#12157 IR ver-bump #12158](project_12157_ir_version_check_required_status.md) · [#11944 SV_Target #11945](project_11944_sv_target_location_order.md) · [#10668 -fvk-bind-globals](project_10668_fvk_bind_globals_set_binding_conflict.md) FIX AUTH-C draft-only · [#10584 SV_Barycentrics cap](project_10584_svbarycentric_capability_check.md) draft #10666
- [#11631 \[require\] SPIR-V caps](project_11631_entrypoint_require_spirv_codegen.md) SHIPPED DRAFT #11633 · [#12196 bindless](project_12196_require_bindless_texture_codegen.md) PARK · [#12316 type-layout dup](project_12316_type_layout_policy_duplication_techdebt.md) tech-debt PARK · [#9153 public-by-default](project_9153_public_by_default_structs.md) Prop 1 LV-2026 · [#9999 switch w/o cases](project_9999_switch_without_cases_diagnostic_fork.md) SEP HELD
- own-bot echoes, 0 dispatch, PARKED, **NOT regressions**: [#12320 coverage-macos segv](project_12320_coverage_macos_segfault_base_rate.md) (~17% base rate; needs workflow-YAML + actions-write) · [#12321 bf16 vec→float4 -vk](project_12321_bfloat16_vector_vulkan_wrong_lanes.md) (CI-claim DISPROVED ⇒ driver-specific L40S; **fleet-host GPU findings need a driver check before filing**)
