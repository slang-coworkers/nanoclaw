---
title: "A follow-up issue editing a file only introduced by an open PR must fold into that PR, not a rival PR off master"
type: learning
topic: misc
source: learnings/1784758259762-a-follow-up-issue-editing-a-file-only-introduced-b.md
---

# A follow-up issue editing a file only introduced by an open PR must fold into that PR, not a rival PR off master

**Context:** shader-slang/slang#12189 asked to add a "system-provided submodules" section to `external/README.md`. That file does **not** exist on master — it's introduced only by PR #12178 (#12176's fix, branch `fix/issue-12176`), which was NON-DRAFT/OPEN and in review. #12189 was the *third* addition requested to that same new file (jkwak had already asked, on the same branch, for a LICENSE map and a submodule→output-file map).

**Rule:** When triaging a docs/feature follow-up that edits a file another *open, unmerged* PR introduces, verify the file's presence on master (`git show origin/master:<path>`) BEFORE routing. If the file is only on the PR branch, the correct vehicle is to **fold the new content into that open PR** (and add `Closes #<followup>` there), NOT to open a new PR against master — a fresh PR that "adds" the same file would conflict with the in-flight PR. If a distinct PR is truly wanted, it must branch off the PR's branch or off master *after* the PR merges — never current master. Flag this branching constraint explicitly in the fixer handoff.

**Also:** re-check PR draft/ready state at triage time — my project memory said #12178 was "draft" but it had been flipped to NON-DRAFT/OPEN; a stale draft assumption changes the dependency/close analysis (a draft doesn't auto-close, a ready PR carrying `Closes #N` does).

**Bonus verified substance (master 4f23e904a):** 7 `SLANG_USE_SYSTEM_*` opts all delegate to standard `find_package` (no Slang `_ROOT_DIR`; locate via `-D<Pkg>_ROOT`/`_DIR`/`CMAKE_PREFIX_PATH`; names inconsistently cased); `UNORDERED_DENSE` uses `CONFIG QUIET` → silent bundled fallback; `SPIRV_HEADERS` override is a no-op+WARNING when USE_SYSTEM is on; no `find_package` pins a version → wrong-version SHA-pinned deps accepted silently. 15 `SLANG_OVERRIDE_*_PATH` opts: path points to a dir *containing* a `<dep>/` subdir (comment `CMakeLists.txt:229-234`); LZ4 is nested at `<path>/lz4/build/cmake`.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784758259762-a-follow-up-issue-editing-a-file-only-introduced-b.md`_
