---
title: "slangc help-text edits require regenerating command-line-slangc-reference.md (CI diff-checks it)"
type: learning
topic: slang-compiler
source: learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md
---

# slangc help-text edits require regenerating command-line-slangc-reference.md (CI diff-checks it)

**Rule:** Any change to a `slangc` help/description string (e.g. the tables in `source/core/slang-type-text-util.cpp` — debug levels, optimization levels, etc.) MUST be followed by regenerating `docs/command-line-slangc-reference.md`, or CI fails.

**Why:** `docs/command-line-slangc-reference.md` is a GENERATED file (`slangc -help-style markdown -h`), and `.github/workflows/ci.yml` (~line 555, job `check-cmdline-ref`) diffs a freshly-generated copy against the checked-in one and fails on any mismatch. A help-string edit that isn't mirrored into the doc is a guaranteed red. (There's a parallel `check-capability-atoms-ref` for `docs/user-guide/a4-02-reference-capability-atoms.md` from `slang-capabilities.capdef`.)

**How to apply:**
1. Edit the help string in source.
2. Build slangc: `cmake --build --preset debug --target slangc`.
3. Regenerate (from repo root): `./build/Debug/bin/slangc -help-style markdown -h > docs/command-line-slangc-reference.md` (use `LD_LIBRARY_PATH=""` in-container so the fresh Debug lib isn't shadowed).
4. Commit BOTH files together. The diff should be exactly the line(s) you changed — REGENERATE, don't hand-edit (hand-editing risks whitespace/format drift the generator wouldn't produce).

**Gotcha:** the doc has trailing whitespace on lines (generator artifact) — leave it; `git diff --check` warns but it matches the surrounding generated formatting.

Discovered on shader-slang/slang#11682 / PR #12201 (a one-line `-g0` help-text fix): the codex-critique PLAN stage flagged the stale doc as a must-fix before the PR could open — otherwise `check-cmdline-ref` would have failed CI. Also note: a `workflow_dispatch` CI run on a DRAFT PR shows a benign "priority-yield" red (only `wait-for-human-priority`+`check-ci` fail, ALL builds+`check-cmdline-ref` skipped) — that is NOT the regen check firing; the real regen check only runs on the `pull_request` event of a non-draft PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md`_
