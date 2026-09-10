---
name: dark_open_chains_restored
description: "RESTORED-FOR-REACHABILITY index: every memo found reachable from NO index whose issue is STILL OPEN upstream (24 at restore time — treat the count as indicative, re-run the sweep). Also the second-parent home for 10 single-parent slangpy/tooling memos. Memos for issues STILL OPEN upstream that were reachable from NO index — found 2026-08-04 by querying every dark memo's issue number upstream WITHOUT a keyword pre-filter. Restored for REACHABILITY ONLY: not re-triaged, re-verify upstream before acting. Includes regressions (#11029, #12096, #12139) and 7 carrying `reproduced`."
metadata:
  node_type: memory
  type: index
  originSessionId: main-2026-08-04
---

# Dark chains with issues STILL OPEN upstream — restored for reachability (2026-08-04)

⛔**How these were missed, and why the fix is a method not a list.** My first dark-set audit
keyword-filtered for `RESUME=`/`ACTIVE`/🔴 markers (36 hits) and queried upstream only for those,
finding 10. **A marker inside a file is a claim about WORDING; liveness is a claim about UPSTREAM
STATE.** Re-run unfiltered — every dark memo carrying an issue number, 117 of them, queried against
`gh` — the real figure is **23 OPEN / 94 closed / 0 unresolved**, and **all 23 had ZERO index
mentions.** A peer hit the identical defect from the other side (its keyword sweep found 2, both
genuine false alarms, then 29 live that the filter never saw). ⭐⭐⭐**The keyword's HIT RATE is
per-container, so neither sweep was evidence about the other's store — only the unfiltered upstream
query is portable.**

⚠️**These are restored for REACHABILITY ONLY — none was re-triaged here.** Several are
maintainer-owned, parked by decision, or superseded. **Open the child and re-verify upstream state
before acting on any of them.**

### Scope of this sweep, stated so the next reader knows what it did NOT cover

**Covered:** every dark memo whose filename yields an issue/PR number, queried individually against
`gh` — no keyword pre-filter. Result **24 open / 101 closed**; the closed ones are correctly cold.

**NOT covered — 7 dark files with NO upstream issue at all**, so "open vs closed" does not apply to
them. They are infra/incident notes, and being unreachable is still a retrieval gap even though no
GitHub query can settle it: `project_gcp_runner_avx512_misreport` (GCP pool mis-reports AVX-512 →
slang-llvm JIT SIGILL), `project_workspace_deletion_incident` (06-24 whole-group workspace wipe
mid-chain), `project_supervisor_scan_malformed_subthread_key_false_escalate`,
`project_release_ci_babysitter_stale_run_reemit`, `project_prod_host_migration_20260717`,
`project_kb_wiki_fold_20260721_pr_blocked` (self-marked SUPERSEDED),
`project_discord_support_heartbeat_dead` (no description field).

⭐⭐**Naming the uncovered residue is part of the result.** "0 open among the remainder" would have read
as *all clear* while 7 files sat outside the instrument's reach entirely — the same shape as a keyword
pre-filter, one level up: **the population you can query is not the population that exists.**

⛔**FOLLOW-UP CORRECTION — 23 was still too low; it is 24.** My issue-number regex matched only
`_<digits>_` / `_<digits>.md`, so it silently skipped memos numbered `pr875`, `samples_46`, etc. and I
filed them as "no number" **without querying them.** Re-queried by hand: 6 nanoclaw PRs closed,
`samples_52` closed, and **`shader-slang/slangpy-samples#46` OPEN** — in a repo my attribution logic did
not even contain. ⭐⭐⭐**A REGEX THAT EXTRACTS THE KEY IS ITSELF A FILTER: "no key found" is a
MEASUREMENT, not a fact — enumerate the misses and resolve them by hand.** ⭐⭐**Same hazard in repo
attribution: my rule mapped everything non-slangpy/nanoclaw to `shader-slang/slang`, which is wrong for
`slangpy-samples` and would have 404'd into a silent "closed."** (Checked the one ambiguous case,
`project_12096_metal4_oscap_macos26_rhi795.md`: `#12096` is genuinely slang and **open**; the trailing
`rhi795` is a secondary reference, closed — primary-number choice was correct there.)

| issue | memo |
|---|---|
| [#46 (slangpy-samples)](https://github.com/shader-slang/slangpy-samples/issues/46) | [project_slangpy_samples_46_tensor_migration](project_slangpy_samples_46_tensor_migration.md) |
| [#12291](https://github.com/shader-slang/slang/issues/12291) | [project_12291_metal_uniform_array_of_resource_unbound_arg](project_12291_metal_uniform_array_of_resource_unbound_arg.md) |
| [#12285](https://github.com/shader-slang/slang/issues/12285) | [project_12285_precise_fma_noinline_stale_version](project_12285_precise_fma_noinline_stale_version.md) |
| [#12268](https://github.com/shader-slang/slang/issues/12268) | [project_12268_triage_workflow_proposal](project_12268_triage_workflow_proposal.md) |
| [#12221](https://github.com/shader-slang/slang/issues/12221) | [project_12221_language_glsl_version_dedup](project_12221_language_glsl_version_dedup.md) |
| [#12139](https://github.com/shader-slang/slang/issues/12139) | [project_12139_shallow_generic_compile_regression_12106](project_12139_shallow_generic_compile_regression_12106.md) |
| [#12132](https://github.com/shader-slang/slang/issues/12132) | [project_12132_analyzemakestruct_positional_oob](project_12132_analyzemakestruct_positional_oob.md) |
| [#12103](https://github.com/shader-slang/slang/issues/12103) | [project_12103_compileperf_depth_workloads_held](project_12103_compileperf_depth_workloads_held.md) |
| [#12096](https://github.com/shader-slang/slang/issues/12096) | [project_12096_metal4_oscap_macos26_rhi795](project_12096_metal4_oscap_macos26_rhi795.md) |
| ~~[#12077](https://github.com/shader-slang/slang/issues/12077)~~ 🔴**NO LONGER OPEN** — closed `not_planned` 2026-08-04 by `swoods-nv` (maintainer declined; docs in too much flux for a PDF). Row KEPT for reachability, **not** liveness — dropping it would re-dark the chain. | [project_12077_pdf_docs_distribution_parked](project_12077_pdf_docs_distribution_parked.md) — ⚠️filename says "parked"; state is **TERMINAL** |
| [#12045](https://github.com/shader-slang/slang/issues/12045) | [project_12045_zero_cast_struct_deprecation_parked](project_12045_zero_cast_struct_deprecation_parked.md) |
| [#12042](https://github.com/shader-slang/slang/issues/12042) | [project_12042_half_double_rounding_parked](project_12042_half_double_rounding_parked.md) |
| [#11997](https://github.com/shader-slang/slang/issues/11997) | [project_11997_hitobject_abi_design](project_11997_hitobject_abi_design.md) |
| [#11990](https://github.com/shader-slang/slang/issues/11990) | [project_11990_iarray_subscript_64bit_pending](project_11990_iarray_subscript_64bit_pending.md) |
| [#11967](https://github.com/shader-slang/slang/issues/11967) | [project_11967_64bit_indexing_e2e](project_11967_64bit_indexing_e2e.md) |
| [#11936](https://github.com/shader-slang/slang/issues/11936) | [project_11936_replay_blob_leak_pr11942](project_11936_replay_blob_leak_pr11942.md) |
| [#11927](https://github.com/shader-slang/slang/issues/11927) | [project_11927_odr_headers_asan_parked](project_11927_odr_headers_asan_parked.md) |
| [#11882](https://github.com/shader-slang/slang/issues/11882) | [project_11882_primal_require_diff_usesite_pending](project_11882_primal_require_diff_usesite_pending.md) |
| [#11784](https://github.com/shader-slang/slang/issues/11784) | [project_11784_conditional_autodiff_pending](project_11784_conditional_autodiff_pending.md) |
| [#11029](https://github.com/shader-slang/slang/issues/11029) | [project_11029_constexpr_param_autodiff_not_fixed](project_11029_constexpr_param_autodiff_not_fixed.md) |
| [#10471](https://github.com/shader-slang/slang/issues/10471) | [project_10471_module_accessibility_parked](project_10471_module_accessibility_parked.md) |
| [#9660](https://github.com/shader-slang/slang/issues/9660) | [project_9660_override_extension_ambiguity_diagnostics](project_9660_override_extension_ambiguity_diagnostics.md) |
| [#9062](https://github.com/shader-slang/slang/issues/9062) | [project_9062_diffptr_array_spirv_validation_parked](project_9062_diffptr_array_spirv_validation_parked.md) |
| [#8681](https://github.com/shader-slang/slang/issues/8681) | [project_8681_debuginfo_strip_spiropt](project_8681_debuginfo_strip_spiropt.md) |

⭐**Notable, from labels at restore time:** #11029 (`regression`, client support, autodiff) ·
#12096 (`regression`, Metal 4 capability) · #12139 (10-15% front-end compile-time regression) ·
and 7 carrying `reproduced` (#11784, #11882, #12221, #12291, #9062, #9660, plus #11963's sibling set).

## ⛔ SECOND INBOUND EDGE — 7 ROUTING-CRITICAL orphans de-risked 2026-08-05 (tail-cut exposure)

**Measured, not assumed:** `MEMORY.md` grew to ~86,800 UTF-16 units via sibling writes, and **every**
routing row now ends between **88% and 97%** through the file — the entire chain-routing layer sits in the
last 12%. Of the 12 targets linked from there, **7 had ZERO other parents**, so a tail cut removes them
outright. This file sits at **24.6%**, so a second edge here survives far deeper cuts than the rows above.

⭐⭐⭐**FAN-IN BEATS TRIMMING under concurrent writers:** a second inbound edge **persists**, while byte
position **moves with every edit by anyone**. Curation demonstrably holds on this container but is outpaced
several-fold; adding an edge doesn't compete with the inflow at all. (Peer's framing — it measured its own
store rather than inheriting my figure, found +23% vs my ~3×, and fixed the same class by fan-in with zero
bytes trimmed.)

⚠️**Honest limit, same as the peer's:** this trades N tail exposures for **one hub exposure** — if the cut
lands above 24.6%, everything behind this file goes at once. Better, not solved. It does nothing about the
growth rate, and the growth rate is not ours to fix.

- [project_fixer_restart_tripwire](project_fixer_restart_tripwire.md) — **LIVE standing directive** (armed, not tripped)
- [slang-ci-infra-chains-index](slang-ci-infra-chains-index.md)
- [slang-rhi-backend-chains-index](slang-rhi-backend-chains-index.md)
- [slang-longtail-chains-index](slang-longtail-chains-index.md)
- [project_11616_forceinline_debugnoscope_caller_scope](project_11616_forceinline_debugnoscope_caller_scope.md)
- [project_11917_pass_gating_epic](project_11917_pass_gating_epic.md)
- [slang-nanoclaw-chains-index](slang-nanoclaw-chains-index.md)
- [feedback_zero_output_is_not_available_scratchpad_still_delivers](feedback_zero_output_is_not_available_scratchpad_still_delivers.md) — *added 08-05: the ONLY target in the whole store that a truncation at the bound genuinely loses (its index row sits at unit 46,539, and its apparent "other parent" was a self-reference, not an edge). Harness behaviour: literal zero output trips an error; scratchpad text outside a `<message>` still delivers.*

## ⛔ SECOND INBOUND EDGE — 10 single-parent memos de-risked 2026-08-04

**Why this section exists.** A truncation simulation showed the `MEMORY.md` slangpy/tooling pointer row
had drifted past the strict (decimal 24,400) bound, and **10 of the 14 memos behind it had exactly ONE
inbound edge** — that row. Lose the row, lose all ten. This file sits at byte ~3,097 in the index, deep
inside both readings, so linking them here gives each a **second path** that truncation cannot take.

⭐⭐⭐**SINGLE-PARENT FAN-OUT IS A TRUNCATION CLIFF; a DAG absorbs it.** N memos behind one pointer is
fine early in a file and fatal at the tail — and **relocation/redundant-linking beats shrinking**, because
a row's position and its in-degree are free to change while its content is not.

- [feedback_two_sets_same_count_different_members](feedback_two_sets_same_count_different_members.md)
- [project_approver_pipeline_defects_devin_fetch_ci_green](project_approver_pipeline_defects_devin_fetch_ci_green.md)
- [project_nanoclaw_1066_kb_fold_bounded](project_nanoclaw_1066_kb_fold_bounded.md)
- [project_slangpy_1040_ci_gpu_oom_peak_vram](project_slangpy_1040_ci_gpu_oom_peak_vram.md)
- [project_slangpy_1079_array_of_tensors_metal_d3d12](project_slangpy_1079_array_of_tensors_metal_d3d12.md)
- [project_slangpy_1089_shader_cache_path_vulkan_segv](project_slangpy_1089_shader_cache_path_vulkan_segv.md)
- [project_slangpy_1090_metal_buffer_from_native_handle](project_slangpy_1090_metal_buffer_from_native_handle.md)
- [project_slangpy_823_tensorview_interop_buffer_noncuda](project_slangpy_823_tensorview_interop_buffer_noncuda.md)
- [project_slangpy_827_torch_scalar_return_wtensor0_crash](project_slangpy_827_torch_scalar_return_wtensor0_crash.md)
- [project_slangpy_996_carrier_pr_1078](project_slangpy_996_carrier_pr_1078.md)

⚠️**Reachability only — no re-triage.** Live state for these lives in
[[slang-slangpy-tooling-chains-index]]; open it before acting.

**Verified after linking:** blast radius **0 under both readings**, each of the ten now has **2 inbound
parents** (here + the slangpy index), 0 dark rules, no dead links.
⚠️⭐⭐**Two of my own verification scripts lied this turn while the state was fine:** one reported
`0/10 memos have ≥2 parents` (a mangled filename extraction — direct `grep -rlF` showed 2 each), and one
died on a stray f-string so an edit went unverified until re-run. **A throwaway checker is an unaudited
instrument: when its answer contradicts a measurement you trust, suspect the checker first and confirm
by hand.** Also caught here: I transcribed `..._ci_grep.md` for `..._ci_green.md`, creating a dead link
the sweep found — ⭐**hand-transcribed filenames need the link sweep, not a re-read.**
