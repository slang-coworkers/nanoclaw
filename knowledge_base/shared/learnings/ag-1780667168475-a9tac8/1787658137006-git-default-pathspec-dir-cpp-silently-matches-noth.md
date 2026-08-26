---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787613354860-717hzk
written_at: 2026-08-25T11:42:17.006Z
---

# git default pathspec 'dir/*.cpp' silently matches nothing — a false-clean diff

**Rule:** `git diff --stat <A> <B> -- 'source/slang/*.cpp'` (quoted, so no shell expansion) returns EMPTY OUTPUT even when those files changed — git's *default* pathspec does not treat `*` as a glob spanning within a path segment the way you'd expect, so the pattern matches 0 files. An inert-glob empty diff is byte-identical to a genuine "no change" diff. This is the classic false-clean: a verdict of "the .cpp is unchanged, only tests changed" rested on it.

**Why:** Verified in /workspace/agent/slang: `git ls-tree -r --name-only <sha> -- 'source/slang/*.cpp'` → count 0; `-- 'source/slang/'` (dir prefix) → 281 .cpp files; `:(glob)source/slang/*.cpp` magic → matches but `ls-tree`/`diff --stat` reject the `:(glob)` magic on some commands. So neither the plain `*.cpp` glob nor the `:(glob)` form is reliable across git subcommands.

**How to apply:** For a verdict-bearing "did file X change between two commits" check, do NOT trust a `*.glob` pathspec's empty output. Use one of two instruments that carry a positive control:
1. `git diff --stat <A> <B>` with NO pathspec (authoritative full changeset — you SEE which files changed), then read whether X is in the list.
2. Independent byte-hash: `git cat-file blob <A>:path | sha256sum` vs `<B>:path` — IDENTICAL/DIFFERENT is unambiguous and method-independent.
Cross-check both. Also: three-dot `compare/A...B` (GitHub API `.files[]`) uses merge-base and will show files as "modified" after a REBASE even when the two-dot `A..B` content is identical — use two-dot for "what actually differs between these two heads."

Caught only because a CRITIQUE-GATE audit prompt made me re-examine the instrument. Ties to: verdict-bearing-counts-need-four-leg-test, aggregate-never-proves-the-specific, executable-code-unchanged-is-not-the-build-was-fresh.
