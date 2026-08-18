---
title: "RESOLVED #12227: GCC PCH snapshots FIDDLE state — fix = exclude slang-compiler.h from GCC PCH (not per-TU)"
type: learning
topic: slang-compiler
source: learnings/1785072236731-resolved-12227-gcc-pch-snapshots-fiddle-state-fix-.md
---

# RESOLVED #12227: GCC PCH snapshots FIDDLE state — fix = exclude slang-compiler.h from GCC PCH (not per-TU)

**Follow-up + resolution to the earlier "Stale GCC PCH snapshots FIDDLE macro state" learning.** Issue shader-slang/slang#12227 is FIXED + MERGED (PR #12233, commit `1e0b3a441a`, merged by maintainer jkwak-work 2026-07-26; `Closes #12227`).

**Two things the triage got directionally right but incompletely scoped:**

1. **The failure is NOT limited to stale `.gch` from incremental builds.** Late CI evidence (jkwak, issue comment 5082032084) showed the identical signature (`slang-ir-insts.h.fiddle:13:22: expected unqualified-id before 'private'` on `slang-ir-autodiff-rev.cpp.o` + `-unzip.cpp.o`) reproducing in **clean GCC Release** builds — SlangPy dispatches for PRs #12229 (all 3 attempts) and #12228, each doing `git clean -ffdx` + fresh clone + `mkdir build`. So a *newly generated* PCH can be internally-inconsistent and consumed in the same highly-parallel clean build; "leftover .gch" was not the complete explanation. Lesson: don't assume an incremental-build artifact is the whole story when the same signature can appear clean.

2. **The winning fix is compiler-scoped PCH-header exclusion, not per-TU SKIP_PRECOMPILE_HEADERS.** The triage's "Approach A" (and the bot's draft PR #12230) applied `SKIP_PRECOMPILE_HEADERS ON` to the two known-bad TUs — a per-*TU* property that compiles those files without the PCH *entirely*. That mitigates the two known TUs but (a) is a bounded allowlist that must grow, and (b) doesn't stop another FIDDLE-consuming TU from failing. jkwak's merged fix instead removes the FIDDLE-carrying header from the **GCC** PCH for *all* TUs, by construction:
   ```cmake
   PRECOMPILE_HEADERS
       ${slang_SOURCE_DIR}/source/core/slang-basic.h
       # slang-compiler.h transitively includes generated .fiddle headers whose macros are keyed on
       # __LINE__. GCC can restore inconsistent FIDDLE macro state from its PCH even in a clean build,
       # so keep those headers out of the GCC PCH. See #12227.
       "$<$<NOT:$<CXX_COMPILER_ID:GNU>>:${slang_SOURCE_DIR}/source/slang/slang-compiler.h>"
   ```
   `slang-basic.h` stays in the PCH for everyone; `slang-compiler.h` (which transitively pulls the `.fiddle` headers with their transient `#define FIDDLE FIDDLEX(__LINE__)` / `FIDDLE_<line>` macro state) is PCH-included only for **non-GNU** compilers. MSVC/Clang keep the full PCH; GCC keeps FIDDLE macro state out of the PCH boundary. Strictly better-layered than the per-TU allowlist — it's the "exclude the FIDDLE generated files from the pch" mechanism jkwak described from the start.

**Process note (chain):** triage posted verdict + approaches → jkwak authorized "approach A" → fixer built draft #12230 → jkwak pushed back (per-TU ≠ file-exclusion) → clean-Release evidence reframed #12230 as *mitigation not root-cause* → jkwak chose (b) and shipped it himself (#12233), closing the draft. The bot chain's value: confirmed diagnosis + mitigation direction; the maintainer's own fix superseded it cleanly. When a maintainer implements + merges their own PR, the issue auto-closes via `Fixes #N` and the maintainer owns the narrative — no bot GitHub comment needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785072236731-resolved-12227-gcc-pch-snapshots-fiddle-state-fix-.md`_
