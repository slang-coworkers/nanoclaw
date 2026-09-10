---
name: project-12227-stale-gcc-pch-fiddle-expansion
description: "slang#12227 stale GCC PCH silently breaks FIDDLE macro expansion — triaged/parked, build-system values call"
metadata: 
  node_type: memory
  type: project
  originSessionId: f7e784b7-e63a-4431-af52-b2f1f1c30265
---

# slang#12227 — Stale GCC PCH silently breaks FIDDLE macro expansion

**Filed 2026-07-25 by jhelferty-nv (self-filed, member). Assignee: jkwak-work (member).**
Bug (build-system correctness) / **P2 / medium** / build-system+tooling (CMake PCH ↔ FIDDLE codegen).

## Symptom
Linux/GCC incremental Debug build (Ninja Multi-Config, PCH on by default): a stale
`cmake_pch.hxx.gch` silently produces ~400 bogus compile errors that look like FIDDLE
codegen bugs. Fails on `slang-ir-autodiff-rev.cpp.o` / `slang-ir-autodiff-unzip.cpp.o`
with `expected unqualified-id before 'private'` in `slang-ir-insts.h.fiddle` (class-body
FIDDLE payload expanding at namespace scope), cascading into incomplete-type errors.
Include chain in diagnostics starts `<command-line>` → `cmake_pch.hxx` = the tell.

## Root cause (author-analyzed, triager-VERIFIED @HEAD 5281ccc66)
PCH invalidation is purely mtime-based. `slang-fiddle` uses `writeAllTextIfChanged`, so
unchanged `.fiddle` outputs keep old timestamps and never mark the `.gch` dirty — even
when its snapshotted preprocessor state (FIDDLE's `__LINE__`-keyed macros + per-header
`#undef`/`#define` + include guards) is inconsistent with the scheme. Build-graph edges
ARE present (`.gch` depfile lists `.fiddle` headers; PCH has order-only dep on
`slang-fiddle-output`) — it's a timestamp gap, not a missing edge. HOW the `.gch` went
bad (interrupted build / overlapping regen / bad 258 MB write) was NOT determined.
Ruled out FIDDLE/generator: source + generated `.fiddle` byte-identical (md5) vs a
clean-building machine; no `__LINE__` skew; `-Winvalid-pch` on cmd line does not fire.

## Solution space (triager memo)
- **A** — `SKIP_PRECOMPILE_HEADERS` on FIDDLE-heavy TUs (mirrors existing
  `slang-rich-diagnostics.cpp` precedent). Recommended now.
- **D** — loud-fail guard emitted from generated `.fiddle` so mis-scoped expansion fails
  with a recognizable message, not a 400-line cascade. Cheap diagnosability; recommended.
- **C** — neutralize snapshotted FIDDLE state; principled long-term but GATED on a
  reproducer for how the `.gch` goes bad (undetermined).
- **B** — explicit stamp→PCH dep. **NOT recommended**: per author's own timeline fiddle
  didn't re-run before the bad `.gch`, so B wouldn't have prevented this instance + costs
  a 258 MB PCH rebuild every fiddle run.

## Workaround (in issue)
`rm build/source/slang/CMakeFiles/slang-common-objects.dir/Debug/cmake_pch.hxx.gch &&
cmake --build --preset debug`, or configure `-DSLANG_ENABLE_PCH=OFF`.

## TERMINAL — RESOLVED by maintainer's own root-cause fix #12233 (2026-07-26)
jkwak-work **merged his own PR #12233** "Exclude FIDDLE headers from GCC PCH"
(1e0b3a441a, `Fixes #12227`) and **closed the bot draft #12230 unmerged**. His fix omits
`slang-compiler.h` from the GCC PCH entirely, keeping FIDDLE macro state out of the PCH
boundary for **all** TUs — not just the 2 the bot's per-TU `SKIP_PRECOMPILE_HEADERS`
mitigation covered. This is the file-exclusion mechanism he signaled from his first review
comment (r3651192649), and it covers the clean-Release scope-expansion too. Outcome:
bot's Approach-A confirmed the diagnosis and the scope-expansion relay fed the final
framing, but the maintainer landed the better-layered fix himself. Chain closed. Issue
auto-closes via #12233's Fixes keyword; jkwak owns the merged-PR trail (no bot GitHub post
needed). Worktree + sentinel cleaned up. NO further action.

## SCOPE EXPANDED — reproduces in CLEAN GCC Release builds too (2026-07-26) [pre-terminal]
jkwak-work posted CI evidence (issue comment 5082032084) that the same failure signature
(`slang-ir-insts.h.fiddle:13:22: expected unqualified-id before 'private'` on
`slang-ir-autodiff-rev.cpp.o` + `-unzip.cpp.o`, `-Winvalid-pch` does NOT fire) reproduces
in **clean GCC Release** builds on CI — SlangPy dispatch workflows for Slang PRs #12229
([run 30168089415](https://github.com/shader-slang/slangpy/actions/runs/30168089415), all
3 attempts) and #12228 ([run 30165485084](https://github.com/shader-slang/slangpy/actions/runs/30165485084)).
Each attempt does `git clean -ffdx` + fresh clone + `mkdir build` + `cmake --preset default`.
**Implication:** stale-`.gch`-from-incremental is NOT the complete explanation — a *newly
generated* PCH in a highly-parallel clean build can be internally inconsistent and consumed
in the same build (clean-build dependency/order race, or a flaw in how transient FIDDLE
macro state is captured). Scope now includes clean GCC Release, not only incremental Debug.
Approach A (two-TU `SKIP_PRECOMPILE_HEADERS`) is now a **mitigation** jkwak agrees "would
likely avoid these observed failures," but it does NOT address root-cause (how a clean
build creates a bad PCH) nor guarantee another FIDDLE-consuming TU won't fail. → Forwarded
into chain 2026-07-26; PR framing should shift fix→mitigation + track a root-cause
investigation. Merge operator-gated; direction is jkwak's call.

## DRAFT PR #12230 CONTESTED on mechanism, reworking (2026-07-25 22:42)
Maintainer/assignee jkwak-work pushed back on draft #12230 ([review thread
r3651192649](https://github.com/shader-slang/slang/pull/12230#discussion_r3651192649)):
he expected "exclude the FIDDLE **generated files** from the PCH." The fixer's A used
`SKIP_PRECOMPILE_HEADERS` — a per-**TU** property that compiles the 2 `.cpp` files without
the PCH *entirely*, rather than excluding the `.fiddle` files *from* the PCH. Both are
valid readings of "approach A"; jkwak wants the **file-exclusion** mechanism. This is a
refinement of jkwak's own "make a PR with approach A" ask, NOT a reversal.
- Fixer conceded on-thread (correct), explained the per-TU-vs-per-file distinction WITHOUT
  overclaiming — codex OUTPUT_REVIEW caught 2 errors in the first draft reply: an
  overstated stale-`.gch` causality, and a proposed generator-epilogue `#undef` fix that
  would break the design (each `.fiddle` is included at the top of its header, consumed
  later). Asked jkwak which exclude-approach he wants before reworking.
- **Next:** jkwak replies on #12230 with preferred exclusion mechanism (likely
  FIDDLE-file-exclusion or PCH-root restructure) → fixer reworks → triager relays. Fixer
  owns PR + review thread, holding for webhook; no re-dispatch. Merge operator-gated.
- Shared learning recorded on per-TU-vs-per-file PCH distinction.

### Prior state — original FIXED (approach A, superseded by contest above)
- **2026-07-25:** jkwak-work (assignee, member) directed via `@nv-slang-bot` on issue
  (comment 5079615613): *"make a PR with approach A."* Green-lit — this was the direction
  the park was held on. Same member-owned build-values pattern as
  [[project_12223_debug_build_og_debuggability]] and #12214.
- **Fix = approach A only:** `SKIP_PRECOMPILE_HEADERS ON` on the 2 FIDDLE-heavy TUs
  (`slang-ir-autodiff-rev.cpp` + `slang-ir-autodiff-unzip.cpp`) in
  `source/slang/CMakeLists.txt`, mirroring the `slang-rich-diagnostics.cpp` precedent with
  a fresh comment. Bounded allowlist (may grow). D (loud-fail guard) NOT taken; C deferred.
- **Draft PR [#12230](https://github.com/shader-slang/slang/pull/12230)** — base `master`,
  head `fix/issue-12227`, `Closes #12227`, label `pr: non-breaking`. Verified OPEN draft.
- **Verification:** no `.slang` regression (build-graph/CMake fix). Validated via
  `compile_commands.json` delta — the 2 target TUs drop `-include cmake_pch`, control
  `slang-ir-autodiff-fwd.cpp` keeps it; both objects compile clean with PCH on. codex
  CODE/PLAN/OUTPUT approve. Peer review dispatched to slang-reviewer — verdict pending.
- **GitHub footprint:** fixer comment 5079807024 on the issue (draft-held → issue comment
  present, guardrail satisfied). Verdict 5-bullet posted earlier (comment 5078944409);
  Issue Type = Build.
- **Next:** maintainer review of draft #12230 → merge (operator-gated, NO auto-merge).
  Triager relays PR state changes + internal review verdict as they land.
Env: commit 5281ccc66, Ubuntu 24.04, gcc 13.3.0.
