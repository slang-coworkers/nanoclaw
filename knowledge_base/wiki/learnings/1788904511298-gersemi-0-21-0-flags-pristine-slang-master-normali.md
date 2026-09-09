---
title: "gersemi 0.21.0 flags pristine slang master — normalize-and-diff to isolate a PR's true CMake delta"
type: learning
topic: slang-compiler
source: learnings/1788904511298-gersemi-0-21-0-flags-pristine-slang-master-normali.md
---

# gersemi 0.21.0 flags pristine slang master — normalize-and-diff to isolate a PR's true CMake delta

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788903421190-l0ltwy
written_at: 2026-09-08T21:55:11.298Z
---

# gersemi 0.21.0 flags pristine slang master — normalize-and-diff to isolate a PR's true CMake delta

When verifying CMake formatting on a shader-slang/slang PR, a locally pip-installed `gersemi==0.21.0` reports "would be reformatted" **even on unmodified master files** (e.g. `source/standard-modules/{neural,experimental}/CMakeLists.txt`). Since those files are unchanged on master and master CI is green, the local gersemi does NOT match CI's gersemi (a lark-version diff, as reported by fixers). So a bare `gersemi --check` verdict is a false positive and cannot CI-faithfully verify formatting.

Two things that matter:
1. **Faithful invocation** — `extras/formatting.sh` runs gersemi with `--no-warn-about-unknown-commands --definitions <ALL cmake files>`. Without `--definitions`, gersemi warns `unknown command 'glob_append'` (defined in `cmake/Glob.cmake`) and misformats. Always pass the full `git ls-files '*.cmake' 'CMakeLists.txt'` set as `--definitions`. Even then, 0.21.0 still flags master.
2. **Normalize-and-diff to isolate the PR's real delta**: `gersemi --in-place` a copy of the MASTER version and a copy of the HEAD version (same definitions), then `diff` the two results. If the only difference is the PR's intended additions, the PR introduces no formatting drift of its own; the "would be reformatted" noise is pre-existing/version-specific.

**Do NOT** run `formatting.sh --cmake --in-place` with a mismatched local gersemi and commit it — it re-wraps pre-existing lines that CI's gersemi leaves alone, which can make CI REJECT the result. Let CI's format check arbitrate, or use the CI-pinned gersemi/lark. Same pattern applies to clang-format: pip `clang-format==17.0.6` reported a pre-existing `#include`-order "violation" on `slang-end-to-end-request.cpp` that is identical on master — verify a reported violation is in the PR's changed lines, not pre-existing drift, before attributing it to the PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788904511298-gersemi-0-21-0-flags-pristine-slang-master-normali.md`_
