---
type: project
name: project-9146-glslang-stdlib-reexport-lto
description: "slang#9146 stdlib symbols re-exported from libslang-glslang — SHIPPED as PR #12379 (linker version-script). Our published LTO root cause was REFUTED and publicly retracted; spawned #12380 (macOS), cites #12355 (m_link null-deref). Chain closed on my side; forensic blow-by-blow pruned 2026-09-04."
---

# slang#9146 — libstdc++ symbols re-exported from libslang-glslang (SHIPPED, root cause retracted)

**Final state:** **PR #12379 shipped** the fix (chain closed on my side 2026-08-06; jkwak-work owns merge). Reporter NBickford-NV; maintainer jkwak-work. Classification: bug (regression) / low severity / build-system·release-CI / P3.

**The fix (verified):** `source/slang-glslang/slang-glslang.version-script` listing the **9 explicit `glslang_*` public names** + `local: *`, wired via `LINK_DEPENDS`, guarded `if(NOT WIN32 AND NOT APPLE)`; `--exclude-libs,ALL` kept as defense-in-depth. Anonymous version tag deliberately (a named tag would add ELF version definitions and change the ABI). Reviewer built a `release.yml` export assertion validating both poles (passes with 9 names; names `glslang_linkSPIRV` when dropped) — taken as a **separate follow-up**, since `release.yml` triggers only on `v20*` tags + `workflow_dispatch` so it can never gate this PR.

## Corrected root cause — it is NOT LTO (our published mechanism was measured false)

We published (comment 5011400207) *"LTO dissolves the archive boundary so glslang's `std::` instantiations escape `--exclude-libs`"* and called the LTO delta "the clincher." **Measured false, retracted publicly** (comment 5199754014):

- IPO is applied only by `slang_add_target`; glslang/SPIRV-Tools arrive via `add_subdirectory`, so `-flto` reaches glslang's objects **0/256** and `libglslang.a` members carry **0** `.gnu.lto` sections. Archives are ordinary objects ⇒ `--exclude-libs` localizes them fine. Even forcing glslang to genuine LTO bytecode (`-flto=auto -fno-fat-lto-objects` + `gcc-ar`) and relinking → **9 exports / 0 `std::`**: GNU ld's LTO plugin still attributes symbols to their originating archive. The "LTO dissolves provenance" story is dead **in both directions**, not merely unconfirmed. (Scoped: GCC 12.2 / binutils 2.40.)
- **The real trigger is release-side and unidentified.** The bug is live (shipped `v2026.14.1` leaks 4 `std::__cxx11::basic_string::_M_*`; leak set drifts between releases; not glslang-specific — `libslang-llvm.so` 4 intended / 27 leaked, etc.). Best remaining suspect is the **linker (binutils) axis** — `--exclude-libs` is a linker feature; a monotone story fits (2.38 leaks, 2.40/2.42 clean) but is unverified on the CI runner. Definitive confirmation is `nm -DC --defined-only` on the next official Linux release artifact — the PR body states green CI is not release verification.

## Open items / follow-ups

- **#12380** — macOS export list unbounded (Mach-O needs `-exported_symbols_list`); the guarded-off platform. Measured: the libstdc++ leak does **not** transfer to libc++ (`std::`=2) but the whole static interior does (3860 exports vs 9 intended). See [[project_12380_macos_glslang_export_bound]].
- **#12355** — `GlslangDownstreamCompiler::link` dereferences a null `m_link` unguarded (`slang-glslang-compiler.cpp:426`), so a dropped export name **crashes rather than diagnoses** — which is why the 9-name list was cross-checked three ways.
- Release-side trigger + jkwak's answer on un-excluding after the version script.

## Fix-specific lessons that stayed here (mechanism-general ones re-keyed below)

- **`.map` → `.version-script` rename was non-cosmetic.** CodeRabbit excludes `!**/*.map` by default (a built-in meant for JS source maps) so it reviewed 2 of 3 files, omitting the one defining the module ABI; and `ld -Map FILE` uses `.map` for *generated* maps. The filename is part of `check_linker_flag`'s cache key, so the rename re-ran the probe correctly. When a tool ignores your file, the fix may be the filename, not the tool config.
- **Wildcard `global: glslang_*` was wrong** — glslang defines 41 of its own `glslang_*`; only the 9 explicit names are Slang's public ABI. See [[feedback_a_wildcard_export_claim_needs_the_link_not_the_file]].

## Process — the critique gate was load-bearing (I control overlays)

Final tally: **7 errors, 2 self-caught, 5 caught by the critique gate** (single generator: *an instrument whose filter/population was wider than the claim*). The two most dangerous — a self-defeating wildcard export and a retraction paragraph that reasserted the retracted claim — reached a public artifact's door and were stopped by the gate. ⇒ **Do not relax or make optional the critique gate on this coworker type for symbol/measurement work.** A subordinate correcting an over-generous tally *upward against itself* is a strong reliability signal — weight its self-reports accordingly.

## Related (re-keyed reusable rules)

[[feedback_a_retractions_own_prose_regenerates_the_retracted_claim]] · [[feedback_gh_pr_checks_dedups_runs_rollup_does_not]] · [[feedback_i_justified_a_decision_with_an_impossibility_i_never_checked]] · [[feedback_a_rule_filed_under_its_consequence_never_fires]] · [[feedback_shallow_clone_makes_your_head_the_graft_root]] · [[feedback_a_denominator_hunt_silently_asserts_the_numerator]] · [[feedback_published_negative_env_claims_need_rederivation]] · [[project_dup_pr_inadequate_existence_check]]
