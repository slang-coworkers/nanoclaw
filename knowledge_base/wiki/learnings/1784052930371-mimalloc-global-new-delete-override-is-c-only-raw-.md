---
title: "mimalloc global new-delete override is C++-only — raw C alloc sites are the cross-platform blocker (slang#12101/#12036)"
type: learning
topic: slang-compiler
source: learnings/1784052930371-mimalloc-global-new-delete-override-is-c-only-raw-.md
---

# mimalloc global new-delete override is C++-only — raw C alloc sites are the cross-platform blocker (slang#12101/#12036)

When triaging cross-platform mimalloc integration in Slang (issue #12101, follow-up to PR #12036), the load-bearing fact is: `mimalloc-new-delete.h` overrides **only C++ `operator new`/`delete`**, NOT C allocation. Slang core has ~24 raw `::malloc`/`::free`/`::realloc`/`posix_memalign` sites across ~12 files (`StandardAllocator` at `source/core/slang-allocator.h:41,45` — the default `List<T>` allocator — plus `slang-blob.h`, `slang-memory-arena.cpp`, `slang-rtti-util.cpp`, `slang-free-list.cpp`, `slang-io.cpp`, `ScopedAllocation`, `OffsetContainer`, `_mallocArray`, aligned-alloc). A new/delete-only override that leaves those C paths on the system allocator = **mixed-allocator hazard** (mimalloc `operator new` freed by system `::free` → heap corruption). That is exactly why upstream SPIRV-Tools force-sets `MI_OVERRIDE=0` off-Windows and why #12036 defaults ON only for shared MSVC Windows. Extending it cross-platform is a per-platform ABI/default-on **policy decision** (operator-override-only-opt-in vs full mimalloc-for-core / Mechanism B of #11925 vs keep-Windows-only), not a mechanical fix.

**Two verification gotchas that mattered here:**
1. Don't conflate `SLANG_ENABLE_MIMALLOC` (the NEW global new/delete override from #12036) with the long-existing `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC` (SPIRV-Tools' own allocator, on master since #8419). A code-reader subagent read the pre-existing option and wrongly concluded "#12036 is merged." **Always cross-check merge state with `gh pr view --json mergedAt` directly** — #12036 was OPEN/unmerged, so `SLANG_ENABLE_MIMALLOC` and `source/slang-mimalloc/` were ABSENT at HEAD. A follow-up tracker can be **blocked-by its own prerequisite PR** — surface that as the Blocker bullet.
2. Routing: bot-filed issue self-assigned to the maintainer who requested it (jkwak-work asked the bot to file + assign to him in the PR review comment) → PARK at maintainer, no fixer, per the self-filed+self-assigned COLLABORATOR standing directive. Still post the verified 5-bullet verdict on the issue.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784052930371-mimalloc-global-new-delete-override-is-c-only-raw-.md`_
