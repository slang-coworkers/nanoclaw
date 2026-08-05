---
name: slang-longtail-chains-index
description: "Chains with no live RESUME trigger of their own, folded out of MEMORY.md on 2026-08-04 to stay under the index read limit. Each row is a pointer plus the one fact that would make me re-open it. No detail lives here — open the child."
metadata: 
  node_type: memory
  type: index
  title: Slang long-tail chains — pointer-only rows
  originSessionId: 2cab8278-7d56-4dbb-8042-3b4981a6079e
---

# Long-tail chains (pointer-only)

## ⛔ 10 DARK CHAINS WITH ISSUES STILL **OPEN** UPSTREAM — indexed 2026-08-04 by `main-2026-08-04` (CROSS-SESSION APPEND)

⚠️**This file is owned by `originSessionId: 2cab8278-…`; `main-2026-08-04` appended this section.**
**Do not delete these links without re-homing them** — each memo is otherwise reachable from NO index.

**How they were found, and why my first answer was wrong:** I claimed all 142 transitively-dark files
"should be cold" **from their `project_*` filename prefix** — a claim about *wording*. A live-state sweep
found 36 carrying `RESUME=`/`ACTIVE`/🔴 markers, and checking each number against GitHub showed **10 are
still OPEN upstream.** ⭐⭐⭐**A filename prefix is not a lifecycle state, and a marker inside the file is
still only wording — liveness is a claim about UPSTREAM STATE, so query the upstream.** (A peer ran the
same sweep, got 2 hits, and both were genuinely false alarms — historical section titles in archives.
**Same method, different result, per container: measure yours.**)

| issue | memo | state |
|---|---|---|
| **#12124** | [autodiff NativeString custom-bwd constants OOB](project_12124_autodiff_nativestring_custom_bwd_constants_oob.md) | **LIVE bug at HEAD**, forwarded |
| **#11963** | [module-scope lambda collision](project_11963_module_scope_lambda_collision.md) | **IN-FLIGHT** |
| **#12032** | [Windows CI crash-dump capture](project_12032_windows_ci_crashdump.md) | resolved; **awaiting maintainer apply** |
| #12004 | [SPIR-V image-vs-sampler param asymmetry](project_12004_image_sampler_param_asymmetry.md) | Approach A rejected (jkwak), PR #12027 closed, issue Unplanned/parked |
| #11669 | [`GetDimensions` WGSL](project_11669_getdimensions_wgsl_parked.md) | parked |
| #12183 | [reflection cumulative-offset helper](project_12183_reflection_cumulative_offset_helper.md) | open |
| #12239 | [switch-case nested block uniqueness](project_12239_switch_case_nested_block_uniqueness.md) | open |
| #12261 | [statement labels non-breakable](project_12261_statement_labels_non_breakable.md) | open |
| #12317 | [slang-web bundler plugins](project_12317_slang_web_bundler_plugins.md) | open |
| #9085 | [GLSL `SampleCmp` takeover](project_9085_glsl_samplecmp_takeover.md) | open |

⚠️**None of these was re-triaged here** — indexing restores reachability only. Open the child before
acting; several are maintainer-owned or parked by an explicit decision.

These were single-fragment rows in MEMORY.md's live section. None has an actionable RESUME trigger
owned by us; each is either maintainer-owned, an epic, or a contract note. **Detail is in the child —
this file adds nothing but the pointer and the re-open condition.**

Folded 2026-08-04 during a compaction pass. Every child was verified present (line counts noted) and
the dead-link sweep returned 0 missing before the fold.

| chain | child | re-open when |
|---|---|---|
| Approver↔reviewer handoff contract — the BLOCK/gap seam | [[project_approver_reviewer_handoff_contract_block_gap]] (24L) | a verdict handoff drops a BLOCK again |
| MDL perf — nightly vs master regression | [[project_mdl_perf_nightly_master_regression]] (25L) | a new nightly delta lands |
| #11952 `module_link` +5% — reopened | [[project_11952_module_link_perf_reopened]] (23L) | maintainer posts a perf verdict |
| #11917 pass-gating epic | [[project_11917_pass_gating_epic]] (191L) | a sub-issue is dispatched to us |
| #11476 autodiff split gate | [[project_11476_autodiff_split_gate]] (19L) | the split gate is re-litigated (also in [[slang-shipped-index]]) |

## Why these left the main index

⭐ **A row whose only content is a link is the cheapest thing to fold, and the safest** — folding
costs nothing but one extra hop, whereas shortening a row that carries a verbatim command, an ID, or
a RESUME trigger destroys load-bearing content. When the index must shrink, **fold pointer-only rows
before you trim substantive ones.** Corollary learned the same pass: check whether the detail is
*already* in a child before shortening anything — three fragments in that pass existed **only** in
the index line (`EDIT-in-place` on #12145 among them) and would have been deleted by a
"move detail to the child" instruction that assumed the child already had it.
