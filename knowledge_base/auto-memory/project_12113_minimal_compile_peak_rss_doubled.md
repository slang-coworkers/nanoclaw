---
name: project_12113_minimal_compile_peak_rss_doubled
description: "#12113 minimal-compile peak RSS doubled v2026.5→.7 — PARKED (maintainer self-assigned)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 41be3092-e6e6-4e3a-87e7-2a82df7d315b
---

shader-slang/slang#12113 — peak RSS for a minimal compile ~doubled between v2026.5 (~101 MiB macOS / 96.7 Linux) and v2026.7 (~213 / 187.1), persists through master (~218). Author + assignee: jvepsalainen-nv (compile-perf owner). Filed 2026-07-15.

**Triage (slang-triager, VERIFIED):** regression / medium / frontend (core-module load, IR serialization) / P2. Labels `reproduced`+`regression`, Issue Type = Performance. Verdict posted to GitHub (comment 4977530963).

**Root cause (localized, FACT):** `createGlobalSession()` eagerly deserializes the embedded core module; its serialized blob (`.rodata` symbol `g_coreModule` in libslang.so) nearly doubled 4.73→9.29 MiB (×1.96), tracking the RSS ratio. Source text flat, no serialization-format change → compiler produces more core-module IR. Leading (unproven-in-isolation) contributor: autodiff refactor **#9808**; smaller: CoopVec/CoopMat SM6.10, Conditional-intrinsic, late-cap-checks. Cheapest next probe (no full build): `nm --size-sort` g_coreModule across in-window commits starting 45ccce9a3.

**Solution space:** (A) reduce what core module serializes, (B) lazier core-module deserialization (also helps #9817), (C) accept as WAI if #9808 knowingly traded footprint.

**Status: PARKED for assignee.** Self-filed + self-assigned by compile-perf owner, explicitly under his own #12112/#9817 tracking — parallel to PARKED [[project_12100_generic_nesting_exponential_compile_parked]] and [[project_12112_compile_perf_memory_tracking_parked]]. NOT dispatched to fixer (per [[feedback_deadpromise_check_assignee_before_rewake]]). Memo: triage-12113.md.

**Update 2026-07-15 (owner comment 4985531658, #12125 pipeline data over all releases incl patches, macOS arm64 empty-compile session floor):** original v2026.5→.7 window stands (~105→~212 MiB). NEW: a *second, separate* +52 MiB step at v2026.10 (v2026.10/.10.1/.9.2/.10.2 ≈ 264 MiB), then **reverted/fixed in v2026.11** (~212) — metric moves silently both directions; v2026.11 fixed a +52 MiB regression likely never noticed. v2026.11 also cut some workloads' own working memory ~2-3x (parse, operator_typecheck) WITHOUT moving the floor → floor and per-workload memory move independently; session floor is the primary optimization target. Once #12125 merges + history re-benched, tracked on memory-releases.html w/ nightly trend alerts. Chain re-affirmed PARKED — owner is actively driving via #12125; forwarded to triager for verdict-tracking. Re-engage only if jvepsalainen-nv requests fixer help.

**Triager verified finding 2026-07-15 (comment 4985583414, additive delta):** original v2026.5→.7 verdict STANDS (owner confirms); no re-classification (still reproduced Performance regression / P2, labels+Type unchanged). NEW verified split: the *second* +52 MiB step (v2026.10, reverted v2026.11) reproduces on Linux (+48 MiB: 187.9→235.9→188.2) BUT `g_coreModule` blob is **FLAT** across it (9.41→9.47→9.43) — whereas the ORIGINAL step WAS blob-driven (×1.96). ⟹ two regressions, **different root causes**: step 1 = core-module IR growth (serialized content); step 2 = runtime/session-init/allocation path, NOT serialized core-module. Confirms owner's "floor & per-workload memory move independently" and narrows any future step-2 bisect. Chain terminal-PARKED for self-driving owner.
