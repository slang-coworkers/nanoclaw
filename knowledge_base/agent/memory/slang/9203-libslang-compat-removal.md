---
type: chain
title: "slang#9203 — Remove libslang and slang.dll rename-compat shims, update docs"
description: Maintainer-filed (jhelferty-nv) packaging cleanup, P2 milestone-deadlined Q4 2026 (due 2026-12-31); triaged 11-26, handed to slang-fixer same minute (session p82yrv); LIVE
tags: [slang, packaging, cmake, libslang, slang-dll, rename-compat, docs]
---

# slang#9203 — remove `libslang`/`slang.dll` compat shims + docs scrub

**Origin.** Human maintainer jhelferty-nv filed 2025-12-03 (assignee zangold-nv, milestone
Q4 2026 due 2026-12-31, label Packaging). The slang→slang-compiler rename (#8746) added
temporary compat outputs — Unix `libslang.so`/`libslang.dylib` symlinks + Windows `slang.dll`
pass-through proxy, all gated by `SLANG_ENABLE_SLANG_PROXY` (default ON). Docs promise removal
"at the end of 2026" (docs/building.md:612). Not a bug — a milestone-deadlined cleanup task.

**Triage verdict** (slang-triager, 11-26 11:37, cmt 7190964373 on the issue): maintenance/cleanup
· severity low · P2 (milestone-deadlined) · not a duplicate (#13308 header-relocation is adjacent,
parked maintainer scope — do NOT fold in). Recommended approach A, full removal in one PR:
- delete the option (root `CMakeLists.txt:224-228`) + both guarded blocks
  (`source/slang/CMakeLists.txt:468-557` win proxy, `:559-586` unix symlink)
- drop orphaned `cmake/RegenerateDllExports.cmake` + matrix entry `.github/cmake-options-matrix.json:32`
- repoint the only hard consumers (Linux/macOS coverage tooling + falcor extras)
- rewrite docs/building.md deprecation section (`:587-616`)
- slang-rhi's `slang.dll` copy is EXISTS-guarded → degrades to no-op, no cross-repo coordination.
Alternatives rejected: B (flip default OFF, remove later — misses the Dec-31 deadline),
C (CMake-only — breaks coverage CI). Install-rule changes verify in minutes via configure-only
build dir + `cmake_install.cmake -P` (no GPU/compile needed) — wiki refs
`concepts/slang-tooling-build-runtime-libs.md`, `concepts/slang-build-cmake-packaging-and-generators.md`.

**Routing state (11-26).** Dispatched 11:32Z from the issue_opened webhook (my bubble
sess-fm03us; triager sess-u0jgxb; 👀 posted). Triager handed to slang-fixer at 11:37 —
**fixer chain LIVE**: sess-1795693041420-p82yrv on canonical thread
`gh-issue-shader-slang/slang-9203`. Fan-out reported to the dashboard (fixer fleet was at ~14
active chains; low severity, but maintainer-filed + Dec-31 deadline justified immediate start).
No open human PR fixes it (closed #11689 only added the CMake gate).

**Watch / next.** **[Fix Report] 13:52Z — FIX COMPLETE bot-side: draft PR #14733 @ `581f06f`**
(4 commits, 22 files +73/−333: CMake removal → consumer repoint → docs → review nits; both nits
applied without another round — N1 ci.yml:856 comment, N2 install-tree assertion in
cmake-options-build.yml). Verification: configure no longer emits the `lib/libslang.so` install
rule/symlink, install tree has none of the 3 compat artifacts, build tree keeps
`libslang-compiler.so` only; front-end 77/77; units 728/729 (1 pre-existing OptiX-SDK env
failure); `extras/formatting.sh --check-only` clean; Codex PLAN/CODE/OUTPUT_REVIEW approve.
**Branch is on the `slang-coworkers` fork (App token can't push `.github/workflows/` edits;
PR REST-opened).** RESTING on human review; **ready-flip pending on the weekly undraft list
(no per-PR ask)** — a human marks ready to trigger CI. Release notes should mention the old
filenames stop shipping (pre-announced since v2025.21). Downstream-packaging double-check the
author asked for is answered by the CI install-tree assertion. Review chain closed 13:54Z —
verdict confirmed at `581f06f` (delta vs reviewed c5e9d9e291 verified directly); one advisory
for the human reviewer: whether the pre-announced package-content removal should carry a
`pr: breaking change` label instead of the default `pr: non-breaking`. Awaiting triager's
[Triage Resolution]; resume on PR webhooks only.
Downstream-packaging double-check the author asked for ("none of the packaging steps expect
their presence") must be answered in the PR. Resume on PR webhooks only.
