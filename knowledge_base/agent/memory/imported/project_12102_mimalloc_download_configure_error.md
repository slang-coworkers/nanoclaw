---
name: project_12102_mimalloc_download_configure_error
description: "slang#12102: external/CMakeLists.txt silently git-cloned mimalloc on a mutable unpinned tag that, after #12036, supplies the whole-DLL allocator; fix = vendor as SHA-pinned submodule, delete the fetch, FATAL_ERROR on missing source. TERMINAL: PR #12107 MERGED 2026-07-15 (c5d4d76e67) at the approver's WOULD_APPROVE head. FINAL pin v2.1.7 8c532c32 after a four-step pin churn (v2.1.7 → v3.3.2 → v2.3.2 via spirv-tools DEPS → v2.1.7 on pdeayton's perf report); the 'two mimalloc versions' worry was disproven (spirv-tools consumes slang's mimalloc_SOURCE_DIR)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3533e4f7-af97-4361-b17c-8711d1ca2b2e
---

# slang#12102 — missing mimalloc source becomes a configure error (TERMINAL)

**✅ MERGED 2026-07-15 02:46:38Z.** PR #12107 merged by jkwak-work as `c5d4d76e67`; issue auto-closed via
`Closes #12102`. Shipped: `external/mimalloc` submodule @ v2.1.7 `8c532c32c3c96e5ba1f2283e032f69ead8add00f`,
deleted the silent `git clone … ERROR_QUIET` fetch, single `FATAL_ERROR` on missing source (fast_float
precedent), `.gitignore`/`.gitmodules` updated — 4 files +11/−24. **No further action.** jkwak said
"let's *start* with 2.1.7", so the pin may be revisited after pdeayton-nv's perf investigation.

## Problem

Filed by nv-slang-bot at jkwak-work's request from his review of #12036. `external/CMakeLists.txt` cloned
mimalloc on the mutable tag `v2.1.7` with `ERROR_QUIET` when source was missing. Once #12036 (merged
07-14, `ad69c2e9f8`) linked `mimalloc-static` into `slang` as the whole-DLL `operator new`/`delete`, a
moved or compromised tag meant arbitrary code in the shipped allocator.

- Not a one-line `FATAL_ERROR`: `external/mimalloc` was not a submodule and
  `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC` defaults ON on Windows, so erroring without vendoring breaks fresh
  Windows clones. ⇒ **Approach A**: vendor as a SHA-pinned submodule + delete fetch + error, one PR.
- **Provenance** (asked by jkwak): download introduced by **PR #8419** (gtong-nv, `8ad0ae17880`,
  2025-09-16; `git log -S "mimalloc.git" -- external/CMakeLists.txt` → one commit). #8460 added
  `SLANG_OVERRIDE_MIMALLOC_PATH`; #12036 widened the blast radius.

## Pin churn (all resolved; final = v2.1.7)

| step | source | pin |
|---|---|---|
| 1 | triager default (tag `v2.1.7`) | `8c532c32` |
| 2 | jkwak "release version 3.3.2" (also the go-signal) | `30b2d9d8` |
| 3 | jkwak "whichever commit spirv-tools uses" — `external/spirv-tools/DEPS` `mimalloc_revision` | `fef6b0dd` = **v2.3.2** (flagged: 2.x, not the 3.x he'd named) |
| 4 | pdeayton-nv: "use v2.1.7, perf regression with 2.3.2 and 3.3.2"; jkwak: "Let's start with 2.1.7" | **`8c532c32` FINAL** |

**Coupling check (from source) — the cross-maintainer conflict had no technical blocker:** when
SPIRV-Tools builds inside Slang, Slang sets `mimalloc_SOURCE_DIR` to its own `external/mimalloc`
(`external/CMakeLists.txt:250`) before `add_subdirectory(spirv-tools)`, and SPIRV-Tools'
`external/CMakeLists.txt:29-31,64` consumes it. `DEPS` is a gclient/gn field, never a CMake input ⇒ one
mimalloc version, whatever slang pins. The `mimalloc-static` target name is unchanged between 2.x and 3.x.

The conflict was surfaced to both maintainers on GitHub (comment 4974727408) rather than auto-flipped;
the fixer built the pin-independent work on `fix/issue-12102` and held push until the SHA was decided.

## Review and merge

- Fixer opened a DRAFT; jkwak (assignee) flipped it ready, left 2 inline comments (fixer answered;
  jkwak resolved both), and APPROVED at head `aa84370058`. `report_pr_created` fired on open and every
  later webhook routed to the fixer's session.
- **slang-pr-approver (shadow): WOULD_APPROVE @ `aa8437005881`** — Devin-only tier (bot-authored PR ⇒
  claude-code-action skips), Devin 0 bugs / 2 advisory, clauses 6/6 under `v0-shadow-relaxed`
  (`external/` not protected there), challenger CLEAN (default Linux/macOS has `SLANG_BUILD_MIMALLOC` OFF;
  Windows CI uses `submodules: recursive`). Codex corrected one reasoning step: a branchless submodule pin
  is checked against the **default branch**, not `refs/tags/v2.1.7` ⇒ verify `8c532c32` is an ancestor of
  mimalloc `main`.
- Merged **unchanged at the approver's decision head** — a clean calibration case; shadow join recorded,
  nothing posted.

## Process notes

- A maintainer stating a design on his **self-assigned** issue is not a go-signal; jkwak says "make a PR"
  when he wants one ([[project_12097_ser_spirv14_vs_12099]]). The chain stayed HELD until an explicit
  pick. Same maintainer-self-assigned hold pattern as [[project_11806_cmake_options_maintainer_selffix]].
- A later pin instruction from a **different** maintainer is a conflict to surface with both tagged, not
  an override to apply.

Related: PR #12036 · [[project_11925_mimalloc_core_parked]] · [[project_12105_mimalloc_windows_malloc_free]] ·
`file(DOWNLOAD … EXPECTED_HASH)` deferred-fatal behaviour lives in
[[project_12116_dxc_prebuilt_zip_500_fetch_flake]].
