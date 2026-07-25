---
name: project_12223_debug_build_og_debuggability
description: "#12223 -Og in Debug build breaks debugging — design-gated PARK"
metadata: 
  node_type: memory
  type: project
  originSessionId: 86f18437-0686-4a2b-bae5-c4f763fc0025
---

shader-slang/slang#12223 — "Degraded debugging experience in debug builds." Reporter juliusikkala (core MEMBER), GCC 15.3.0: `<optimized out>` locals + single-step jumping across functions. Reverting #12140 fixes it.

**Root cause (VERIFIED @HEAD 5281ccc66, source inspection):** PR #12140 (merged 07-17, commit d9c9fa4, author skiminki-nv) added in `cmake/CompilerFlags.cmake:195` (inside `set_default_compile_options`):
`target_compile_options(${target} PRIVATE $<$<CONFIG:Debug>:-Og>)` guarded by `GNU|Clang AND NOT MSVC`. `-Og` is appended AFTER `CMAKE_CXX_FLAGS_DEBUG` (`-O0 -g`) → last-`-O`-wins → Debug compiles at `-Og`. No opt-out short of editing source.

**Classification:** regression / medium / P2 / build-system(CMake,CI). Dev-experience only, no shipped-binary impact. `regression` label applied; NOT `reproduced` (this box GCC 12, severity is GCC-15-scaled hypothesis, cause confirmed). Type "Build" already set.

**Solution space (mechanism SETTLED, default UNSETTLED):** gate `-Og` behind a `SLANG_ENABLE_*` option (matches SLANG_ENABLE_RELEASE_LTO convention, ~1-line guard). Default is the design call:
- A: opt-OUT, default ON — keeps #12140's ~4× Debug-build speedup (95m→21m slang-test) for CI; debuggers pass `-DSLANG_ENABLE_DEBUG_OPTIMIZATION=OFF`.
- B: opt-IN, default OFF — "Debug" debuggable by default (RelWithDebInfo already = fast+debug-info); opt in for speed. Triager's lean.
- C: straight revert — NOT recommended (discards benchmarked win).

**State: PARKED-at-triaged (design gate).** Default is a values tradeoff between two core MEMBERs (juliusikkala vs skiminki-nv). Verdict + blocker posted on issue (comment 5074128097) inviting maintainer decision. NOT dispatching fixer — would bake in unresolved default; avoids taskless-fixer session. RELEASE = maintainer/skiminki-nv picks default → then dispatch slang-fixer with chosen approach. Memo held by slang-triager; fixer holding do-not-implement.

**Decision-support (fixer investigate-only, re-verified by triager @HEAD 5281ccc66) — SHARPENED RECOMMENDATION:** default **OFF (opt-in) + pin ON in CI's Debug legs** — humans get debuggable Debug by default, CI keeps ~4× speedup. Load-bearing facts:
1. RelWithDebInfo is NOT assertion-preserving — `SLANG_ASSERT` is `#ifdef _DEBUG` (slang-common.h:363), `_DEBUG` defined only for Debug config (CompilerFlags.cmake:231); RwDI carries NDEBUG → strips all SLANG_ASSERT. Weakens the "RwDI already = fast+debuggable" argument; reinforces "Debug should be debuggable+assertion-carrying by default."
2. CI builds Debug on 21 legs (vs 32 release / 3 RwDI) → default OFF has real CI wall-clock cost → hence the CI-pin.
3. `SLANG_ENABLE_*` defaults are MIXED (ASAN/COVERAGE/TIME_TRACE/LTO=OFF; PCH/RELEASE_DEBUG_INFO/SPLIT_DEBUG_INFO=ON) → convention alone doesn't settle default.
Implementation when released ≈ ~2-line CMake gate + CI Debug-leg pin (Approach B shape). Recommendation NOT a blocker — still a maintainer values call. No new GitHub post (bot shouldn't push the values call publicly; ask already live).

See [[feedback_dont_close_open_proposals]], [[feedback_reopen_not_release_parked_feature]], [[project_taskless_fixer_review_cc_loop]].
