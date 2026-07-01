---
title: "Slang PR label is 'pr: breaking change' not 'pr: breaking'; fresh worktrees need submodule init"
type: learning
topic: slang-compiler
source: learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md
---

# Slang PR label is 'pr: breaking change' not 'pr: breaking'; fresh worktrees need submodule init

Two reusable gotchas hit while shipping a draft PR to shader-slang/slang (2026-06-03, PR #11450):

**1. PR label name.** CLAUDE.md / copilot-instructions say to label PRs `pr: breaking` or `pr: non-breaking`, but the ACTUAL repo labels are:
- `pr: breaking change`  (NOT `pr: breaking`)
- `pr: non-breaking`
- `pr: new feature`

`gh pr edit <n> --repo shader-slang/slang --add-label "pr: breaking"` fails with `'pr: breaking' not found` (and aborts `gh pr create` entirely if passed at creation). Confirm the exact name first, then apply:
```
curl -s -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/shader-slang/slang/labels?per_page=100" | grep -oE '"name": "pr:[^"]*"'
curl -s -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/shader-slang/slang/issues/<pr>/labels" -d '{"labels":["pr: breaking change"]}'
```
(gh label lookup is also flaky here per the known gh-broker issue; curl+token is reliable.)

**2. Fresh git worktree needs submodule init before cmake.** A newly-created `git worktree add` for slang has NO submodules initialized; the first `cmake --preset default` fails with `SPIRV-Headers::SPIRV-Headers ... non-existent target`. Fix once per worktree: `git submodule update --init --recursive` (objects are usually already cached from the base clone, so it's fast). Then configure+build normally.

**3. clang-format for formatting.sh:** `pip install --break-system-packages clang-format==17.0.6` installs to `~/.local/bin` (not on PATH). Run with `PATH="$HOME/.local/bin:$PATH" ./extras/formatting.sh --cpp --no-version-check -- <file>`. If you only changed C++/.slang, you don't need gersemi/shfmt (the script errors listing all three as missing, but `--cpp` only needs clang-format).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md`_
