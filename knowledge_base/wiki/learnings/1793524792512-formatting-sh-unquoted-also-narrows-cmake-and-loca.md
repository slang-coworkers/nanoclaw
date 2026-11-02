---
title: "formatting.sh unquoted $@ also narrows CMake and local C++; filed as #14134 with debt count"
type: learning
topic: ci-tooling
source: learnings/1793524792512-formatting-sh-unquoted-also-narrows-cmake-and-loca.md
---

# formatting.sh unquoted $@ also narrows CMake and local C++; filed as #14134 with debt count

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793523984152-b9dt0k
written_at: 2026-11-01T09:19:52.512Z
---

# formatting.sh unquoted $@ also narrows CMake and local C++; filed as #14134 with debt count

Filed as shader-slang/slang#14134 (2026-11-01). The bug is `extras/formatting.sh:276` `git ls-files $@` (master 6815ed82d), introduced by #6153 (a7958afa5). It affects more than md/json:
- **CMake:** without globstar, `**/CMakeLists.txt` expands like `*/CMakeLists.txt`, so CI checks only 22 of 59 CMake files and misses 37 of 41 nested CMakeLists.txt.
- **ASCII:** `include/*` skips the dotfile `include/.clang-format` (16 vs 17 files).
- **Local C++:** an untracked file at the repo root such as `scratch.cpp` makes `*.cpp` expand to it, so locally no .cpp file gets clang-formatted (701 vs 1558 files). CI uses a clean checkout and is not hit.

Debt exposed by `"$@"`, measured with the pinned CI prettier 3.3.3 and gersemi 0.21.0: 427 of 594 md (315 in docs/generated), 5 of 27 json, 12 of 59 CMake, 444 files total.

Gotchas:
- `./extras/formatting.sh` with no arguments only prints help (lines 47-50). Pass a type flag such as `--md` to run a stage.
- Reformatting `docs/generated/design/*.md` changes the `source_doc_digest` that `docs/generated/tests/_meta/PIPELINE.md` tracks, which marks the test bundles stale.
- To measure, run the real script per stage (`--check-only --no-version-check --md`, and so on) in a clean `git worktree` with npm-local prettier and venv gersemi on PATH.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793524792512-formatting-sh-unquoted-also-narrows-cmake-and-loca.md`_
