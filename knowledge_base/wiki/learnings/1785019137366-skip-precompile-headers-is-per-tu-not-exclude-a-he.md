---
title: "SKIP_PRECOMPILE_HEADERS is per-TU, not 'exclude a header from the PCH'"
type: learning
topic: misc
source: learnings/1785019137366-skip-precompile-headers-is-per-tu-not-exclude-a-he.md
---

# SKIP_PRECOMPILE_HEADERS is per-TU, not "exclude a header from the PCH"

**Context:** slang#12227 / PR #12230. Triage's "Approach A" for the stale-GCC-PCH-breaks-FIDDLE bug was `set_source_files_properties(<tu>.cpp PROPERTIES SKIP_PRECOMPILE_HEADERS ON)`, mirroring the existing `slang-rich-diagnostics.cpp` precedent in `source/slang/CMakeLists.txt`. Maintainer jkwak-work pushed back: "I thought we were going to exclude FIDDLE generated files from the pch. But this doesn't look like what it does."

**The distinction (non-obvious, cost a review round):**
- `SKIP_PRECOMPILE_HEADERS ON` is a **per-translation-unit** CMake source-file property. It makes *that whole `.cpp`* compile WITHOUT `-include cmake_pch.hxx`. It does NOT remove any particular header (e.g. the generated `.fiddle`) from the PCH content — the PCH is still built the same way; those TUs just don't use it.
- "Exclude the FIDDLE generated files from the PCH" is a *different* mechanism: keep the `.fiddle` includes out of the PCH root so no FIDDLE macro state is ever snapshotted, or add a cleanup include after the last FIDDLE marker. That preserves the PCH for all TUs and fixes the root fragility.

**Why a naive per-`.fiddle` `#undef` epilogue does NOT work (codex caught this):** each `.fiddle` is `#include`d near the TOP of its header, and its `FIDDLE`/`FIDDLEX`/`FIDDLEY`/`FIDDLE_<n>` macros are consumed LATER by that same header's own `FIDDLE(...)` expansion sites. Undef-ing at the physical end of the `.fiddle` would remove the macros before their consumers run.

**Also:** the FIDDLE stale-`.gch` bug's exact corruption mechanism (how a bad `.gch` arises + how it mis-expands a later `.fiddle`) is UNPROVEN — the reporter established experimentally that the stale `.gch` triggers it (remove `-include cmake_pch` or rebuild `.gch` → fixed) but the macro-state causal chain is a hypothesis. Don't overclaim it to a maintainer.

**Lesson:** when a triage hands you a CMake "approach," restate what the mechanism *actually does* (per-TU skip vs per-file exclusion vs generator-side neutralization) before shipping, and match it to what the maintainer's words imply — the request "make a PR with approach A" can still be the wrong mechanism if the maintainer's mental model was the other one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785019137366-skip-precompile-headers-is-per-tu-not-exclude-a-he.md`_
