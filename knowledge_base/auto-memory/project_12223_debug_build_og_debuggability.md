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

**RESUME 07-27 — skiminki-nv (author/maintainer) commented (5089258348):** RESOLVED against the earlier fixer/triager "lean default-OFF/`-O0`" — skiminki says `-O0` default is "basically a showstopper" (full test suite prohibitively slow); prefers release builds over `-O0`. Two reasonable paths, he LEANS **option 2**:
- Opt 1: gate `-Og` behind `SLANG_ENABLE_*` (bot's suggestion).
- Opt 2 (his lean): provide a way to OVERRIDE optimization flags so those who find `-Og` problematic supply their own (e.g. `-O0 -g3`); bonus = trivial `-march=...` experimentation. Notes `CXXFLAGS='-O0 -g3' cmake --preset default` "doesn't work in Slang" today.
Root of why opt2 doesn't work today (hypothesis, for fixer to confirm): `set_default_compile_options` appends `-Og` via `target_compile_options` AFTER `CMAKE_CXX_FLAGS_DEBUG`/user `CXXFLAGS` → last-`-O`-wins clobbers user override. Opt 2 fix ≈ suppress `-Og` when user supplied an opt level, or add a Slang cache-var hook.
State: chain RESUMED → forwarded to slang-triager (07-27) to have fixer investigate opt-2 feasibility (still investigate-only/decision-support — "might suggest", not a firm "make the PR"; no juliusikkala concurrence yet). Firm opt1-vs-opt2 decision remains the dispatch gate. Fixer still do-not-implement until locked.

**FEASIBILITY FINDING 07-27 (fixer + triager independently re-reproduced @HEAD a4168d47c6; both empirical probes):**
- Q1 CONFIRMED: `-Og` is a target-level PRIVATE append (CompilerFlags.cmake:196); compile-line order = `CMAKE_CXX_FLAGS`(←env CXXFLAGS) → `CMAKE_CXX_FLAGS_DEBUG` → target opts (last) → `-Og` wins last-`-O`-wins → user `-O0` clobbered. Env CXXFLAGS structurally can NEVER win. Correction: CompilerFlags.cmake:180 comment says `CMAKE_CXX_FLAGS_DEBUG=-O0 -g` but cache value is really just `-g` (`-O0`=GCC implicit default); conclusion unchanged.
- Q2: **shape (a) "conditional-skip"** (inject `-Og` only if user gave no `-O`) ✅ minimal (~+3/−1, one file), reproduced 3 cases (none→`-g -Og`; env `-O0 -g3`→user wins; `-DCMAKE_CXX_FLAGS_DEBUG` override→user wins); honors skiminki's literal workflow, avoids check_cxx_compiler_flag genexpr trap. Shape (b) "-Og as CMAKE_CXX_FLAGS_DEBUG default" ❌ env still loses. Shape (c) named var `SLANG_DEBUG_OPTIMIZATION_FLAG` = most discoverable + `-march=` but doesn't honor literal env workflow.
- **Opt-2 FUNCTIONALLY SUBSUMES opt-1** (shape (a) covers "force -O0" + arbitrary flags); loses only DISCOVERABILITY (juliusikkala's exact gap) → mitigate w/ docs note or layer (c). They compose.

**DECISION 07-27 (Main): REPLY on GitHub, nudge opt-2 shape (a) + docs note.** Earlier "no post/values-call" steer LIFTED — opt-2 shape(a)+docs satisfies BOTH maintainers (no longer zero-sum), skiminki referenced the bot + host routed as pr_mention (posting authorized). Authorized slang-triager (closest-to-state; owns issue footprint) to post: findings as FACT, direction as OFFER (not locked), invite @juliusikkala concurrence, offer to open PR on maintainer go-ahead. Fixer STILL do-not-implement until an explicit "make the PR". Dispatch gate = maintainer picks + says go.

**POSTED 07-27 (nv-slang-bot):** GitHub reply live at issue comment [5089425319](https://github.com/shader-slang/slang/issues/12223#issuecomment-5089425319) — Q1 mechanism + shape-(a) 3 cases + subsumption as fact; opt-2 as offer; @skiminki-nv (mechanism/`-march=`) + @juliusikkala (discoverability) both mentioned; "happy to open the PR — just confirm". State HELD. Resume trigger: substantive reply from skiminki-nv or juliusikkala → triager forwards on canonical thread → Main routes fixer to implement shape (a) + docs note.

**GO-AHEAD 07-27 — skiminki-nv (maintainer/author): "@nv-slang-bot Create a PR for Option 2" (comment 5091273388).** Explicit "make the PR" — dispatch gate RELEASED. UNPARKED → active fix. Routed via slang-triager to slang-fixer (07-27) to IMPLEMENT opt-2 shape (a): inject `-Og` only when user supplied no `-O` level, in `cmake/CompilerFlags.cmake` (~+3/−1, guard the :196 target_compile_options append) + docs note in `docs/building.md` (the `CXXFLAGS='-O0 -g3'` / `-march=` override now works). Default `-Og` UNCHANGED (CI keeps speedup). Draft PR w/ `Fixes #12223` + 5-bullet, report_pr_created, `<github-post-authorized />` (maintainer-requested via bot mention). Merge OPERATOR-gated. juliusikkala discoverability closed by docs note.

**DRAFT PR #12234 OPENED + VERIFIED 07-27** (https://github.com/shader-slang/slang/pull/12234) — OPEN draft, base master, head `fix/issue-12223`, label `pr: non-breaking`, `Closes #12223` (authoritative closingIssuesReferences=[12223]), report_pr_created done. Diff: `cmake/CompilerFlags.cmake` (+34/−14) inject `-Og` only if user chose no `-O` (whole-`-O`-token match on CMAKE_CXX_FLAGS+_DEBUG); default STAYS `-Og` (CI/#12140 speedup unchanged); `docs/building.md` (+33/0) new "Optimization level of Debug builds" section. No `tests/*.slang` (build-system-only; verified via Ninja-MC compile_commands.json probe + `cmake -P` regex: default→`-g -Og`; `CXXFLAGS='-O0 -g3'`/`-DCMAKE_CXX_FLAGS_DEBUG`→user wins; `-O4/-Os/-Ofast`/bare `-O`→suppress; `-ObjC/-Onone/-march=native`→keep). codex PLAN+CODE+OUTPUT approve; gersemi clean. CI red = benign priority-yield (wait-for-human-priority + check-ci; build/test skipped; CI Retry Yielded Bot reruns) — NOT a regression. Reviewer routed by Main (triager has no reviewer edge). Merge operator-gated. Triager deferring issue-verdict refresh to merge close-out; Main posting brief PR-up ack on issue to close skiminki's "@nv-slang-bot Create a PR" loop.

**2026-07-27 13:14 — reviewer IN FLIGHT, verified (Main).** PR #12234 head `9898dc30c2`, draft, under active review — **3 slang-reviewer sessions live on thread `gh-issue-shader-slang/slang-12223`** (last-active 13:12–13:14Z, Main-verified). Confirms Main's earlier reviewer dispatch landed (fixer msg 69598 "reviewer-routing handled through parent" = already-routed, verdict returns to fixer — NOT a gap to close). Fixer correctly silent-holding; nothing owed by Main. **✅ slang-reviewer ADDRESSABLE AGAIN → clears the #12210 "not addressable" WATCH** ([[project_12210_autodiff_property_getter_frontend_crash]]) — that was transient/session-specific (07-26), NOT a persistent reviewer outage; no operator re-auth needed. Next: reviewer verdict → fixer; merge OPERATOR-gated.

**2026-07-27 ~13:49 — PR #12234 assigned to skiminki-nv by jkwak-work** (benign chain-state advance; no reply/no GitHub action owed — bots don't touch assignees/reviewers; fixer confirmed needs-nothing-back). Sharpens resume trigger: skiminki-nv is now de-facto reviewer/assignee → his review or comment is the expected next substantive event (alongside slang-reviewer's consolidated A/B/C verdict, still in flight — B+indep-CMake clean, A re-run churning, C pending).

See [[feedback_dont_close_open_proposals]], [[feedback_reopen_not_release_parked_feature]], [[project_taskless_fixer_review_cc_loop]].
