---
name: project_12054_msvc_release_opt_ref_icf
description: "#12054 MSVC Release PDBs disable /OPT:REF+/OPT:ICF — TRIAGED+PARKED, deferring to pdeayton-nv self-fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: eae37f8e-d68d-447c-997c-cf824de2050d
---

shader-slang/slang#12054 — MSVC `SLANG_ENABLE_RELEASE_DEBUG_INFO=ON` (default) injects `/DEBUG` on Release links (`cmake/SlangTarget.cmake:298-302`, from #5783), which flips MSVC `/OPT` defaults REF→NOREF, ICF→NOICF; nothing re-asserts them → default Release loses dead-code elim + COMDAT folding. Bug/medium/P2, `regression` label + Type=Bug set.

**State: RE-ENGAGED 07-11 — maintainer authorized bot PR.** pdeayton-nv (comment 4940897967): *"@nv-slang-bot, please draft a PR for this. Make the fix for Release only, don't change RelWithDebInfo."* Routed authorization THROUGH triager (chain owner, holds memo) on canonical thread → fixer. Prior verdict posted: issue #12054 comment 4940741532.

**Fix (AUTHORIZED, Release-ONLY per maintainer):** Approach A' scoped to `$<CONFIG:Release>` ONLY (NOT `Release,RelWithDebInfo`). Co-locate `/OPT:REF`+`/OPT:ICF` with the `/DEBUG` injection at `SlangTarget.cmake:298-302`, MSVC-guarded. Release-only scope sidesteps the LNK4075 wrinkle entirely — Release CMake default already carries `/INCREMENTAL:NO`; do NOT touch RelWithDebInfo (its default is `/INCREMENTAL`). No MSVC in container → verify via generated build.ninja/link rule (confirm `/OPT:REF`+`/OPT:ICF` on Release link, `/DEBUG` still present); state MSVC-validation limitation in PR.

**Guardrails:** DRAFT-only (pdeayton-nv said "draft"; he reviews→flips ready→merge — never bot ready-flip/merge). PR desc carries `Fixes #12054` + 5-bullet; fixer MUST call report_pr_created. Maintainer @nv-slang-bot mention = GitHub posting authorized for ack.

**07-11 — DRAFT PR #12061 OPEN** (https://github.com/shader-slang/slang/pull/12061). Single-file `cmake/SlangTarget.cmake +12/-1`: added `$<$<CONFIG:Release>:/OPT:REF>`+`$<$<CONFIG:Release>:/OPT:ICF>` to the same MSVC `target_link_options` as `/DEBUG`; RelWithDebInfo/Debug untouched. Genex-scope verified via file(GENERATE)+TARGET_GENEX_EVAL (Release=`/DEBUG;/OPT:REF;/OPT:ICF`, others=`/DEBUG` only); NOT validated on real MSVC link (no MSVC in container) — PR body flags this + asks Windows maintainer to confirm. codex PLAN/CODE/OUTPUT approve. Red CI on head = benign priority-yield (draft path skips 33 jobs; pull_request run 0 failures) — see [[project_bot_pr_priority_yield_red_run]]. Triager posting "fix in draft #12061" footprint on issue (draft doesn't auto-close). **Next:** @pdeayton-nv/Windows maintainer confirms real MSVC Release link → flips ready → merges; bot holds. report_pr_created VERIFIED-LIVE (return value + a real github.ci_failed webhook for #12061 already routed to fixer's session — empirical proof, [[feedback_verify_report_pr_created]]). pdeayton-nv review comments will route to fixer, no orphaning. **Chain parked at draft-review; triager reports review/ready-flip/merge on canonical thread as they land.** Related build parks: [[project_11806_cmake_options_maintainer_selffix]], [[project_11919_remove_ox_optins_parked]].
