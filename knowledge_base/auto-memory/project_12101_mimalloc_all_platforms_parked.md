---
name: project_12101_mimalloc_all_platforms_parked
description: "slang#12101 extend mimalloc global new/delete to all platforms — PARKED at maintainer, blocked-by"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfaed2db-6940-4341-82c4-8319a8668882
---

shader-slang/slang#12101 — "Apply mimalloc global new/delete override to all platforms (follow-up to #12036)". Bot-filed (nv-slang-bot) at jkwak-work's request in PR #12036 review comment r3581454146 ("make a new issue... assign it to me"); **self-assigned to jkwak-work** (COLLABORATOR). Triaged & verified @HEAD 3eeda847c 2026-07-14.

**Verdict: PARK at maintainer, NO fixer.** Reasons: (1) COLLABORATOR self-filed+self-assigned → triage+verdict only per standing directive; (2) design-gated protected-path work (`.github/cmake-options-matrix.json` + per-platform ABI/default-on policy = maintainer decision).

**STATE UPDATE 07-22 (blocker cleared):** #12036 **MERGED** 07-14T22:32Z (mergeCommit `ad69c2e9f8`) — the "blocked-by #12036" reason is now STALE. Two follow-ups landed since: **#12105** routes StandardAllocator/AlignedAllocator through mimalloc's C API → **closes the raw-C-alloc gap** (the mixed-allocator hazard crux flagged below); **#12107** fixed a missing-mimalloc-source configure error. Default guard unchanged (`WIN32 AND MSVC AND SHARED AND !ASan`). So #12101 is **no longer blocked** — the non-Windows extension is the remaining open work, awaiting jkwak's A/B/C policy decision.

Re-verified @HEAD `d384b77e6` on 07-22 when triager answered jkwak-work's on-issue question ("benefit/downside of mimalloc in general") — reply posted issue #12101 comment 5051807385 (throughput/MT-scaling/fragmentation/diagnostics upsides; binary-size, allocator-mixing, platform-sensitive ABI/interposition, ASan-tracking-loss, measure-before-default-on downsides).

**Load-bearing technical finding:** `mimalloc-new-delete.h` overrides ONLY C++ `operator new`/`delete`, not C allocation. Slang core has ~24 raw `::malloc`/`::free`/`::realloc`/`posix_memalign` sites across ~12 files (StandardAllocator `slang-allocator.h:41,45`, slang-blob.h, slang-memory-arena.cpp, slang-rtti-util.cpp, slang-free-list.cpp, slang-io.cpp, aligned-alloc, ScopedAllocation, OffsetContainer). A new/delete-only override off-Windows → mixed-allocator heap-corruption hazard (mimalloc new / system free). This is why SPIRV-Tools force-sets `MI_OVERRIDE=0` off-Windows. Design menu: A (operator-override opt-in, non-Windows default OFF, per-OS CI, measure before default-on); B (full mimalloc-for-core = #11925 Mechanism B, convert raw-C sites, hazard-free); C (keep Windows-only).

Related: partial slice of [[project_11925_mimalloc_core_parked]] (broader "mimalloc for Slang core"). Verdict posted: issue #12101 comment 4972497505. **Re-engage triggers:** #12036 merges (unblocks), or jkwak-work picks A/B/C and requests fix dispatch, or a substantive human comment lands. Do NOT auto-dispatch a fixer.
