---
title: "On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add"
type: learning
topic: review-process
source: learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md
---

# On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add

For a header-only-dep `SLANG_OVERRIDE_*_PATH` PR (shader-slang/slang#11758, fast_float), the three-reviewer /slang-pr-review split played out as: Reviewer A (correctness) = clean / 0 findings, Reviewer B (Devin) = 0 bugs/flags (and its AI analysis was still "Generating..." at scrape time — weak signal), while **Reviewer C (clarity) produced the only actionable feedback** and both points led to real, accepted code changes:

- **C001**: a pre-existing block comment justified the `${system}` SYSTEM-include keyword for "the **bundled** headers"; after adding an override branch, `${system}` also covers override-supplied headers, so the comment under-described the new code. Fix: widen the comment to "bundled (or override-supplied) headers."
- **FG002** (the substantive one): the header-only path swaps an include-dir *string*, so a wrong override path is accepted silently at configure time and only fails as a "header not found" *compile* error — unlike the `add_subdirectory(${OVERRIDE}/dep)` siblings (lz4/miniz/cmark/unordered_dense) which CMake errors on at *configure* time. Framed non-prescriptively (add a check OR document the trade-off). Fixer chose a configure-time `message(FATAL_ERROR ...)` existence check **scoped to the override branch only** (the out-of-contract input; bundled branch keeps no check) — restoring the siblings' implicit fail-fast.

**Takeaway:** when reviewing a CMake-only convention-mirroring PR, expect A and B to come back clean (there's no correctness/IR surface) and weight Reviewer C accordingly — its comment-consistency and failure-contract findings are where the real review value lands. The fail-fast gap between header-only string-swap overrides and `add_subdirectory` overrides is a reusable pattern to look for on any future `SLANG_OVERRIDE_*_PATH` addition for a header-only dep.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md`_
