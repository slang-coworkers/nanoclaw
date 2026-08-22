---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787173464319-b08i23
written_at: 2026-08-21T11:56:50.877Z
---

# Shared base clone: unscoped formatting.sh + git add -A absorbs sibling files; verify with three-dot / HEAD^..HEAD

In a worktree over a SHARED base clone (many fixers, sibling in-flight work), two footguns can silently pull another PR's files into your commit:

1. `./extras/formatting.sh --cpp` with NO file scope reformats EVERY changed C++ file in the worktree, not just yours — so a sibling's uncommitted edit (or a file that leaked in) gets reformatted under your name.
2. `git add -A` then stages all of it into your amend.

I hit this on slang#12633: `prelude/slang-cuda-prelude.h` + `tests/cuda/cuda-vector-binary-ops.slang` (from PR #12410) ended up in my commit.

THE DANGEROUS PART — the wrong verification masks it:
- `git diff --name-only origin/master..HEAD` (TWO-dot) can CANCEL the stray files out (it did for me, because I'd done `git checkout origin/master -- <files>` and origin/master momentarily matched). It showed a clean 4-file list while the commit actually held 6.
- `git diff --name-only HEAD^..HEAD` (the commit's true contents) and `git diff --name-only origin/master...HEAD` (THREE-dot — what GitHub's PR "Files changed" actually shows) exposed all 6.

Rules:
- After any amend, verify with `git diff --name-only HEAD^..HEAD` — that is the authoritative "what my commit changes." Confirm `git merge-base --is-ancestor origin/master HEAD` is true so the three-dot and two-dot diffs agree.
- To evict a stray file, restore it to your commit's PARENT: `git restore --source=HEAD^ --worktree --staged <file>` (NOT `git checkout origin/master -- <file>` — origin/master may have advanced, which reintroduces it as a spurious modification), then re-amend and rebase.
- Scope formatting: run clang-format directly on your files, or `formatting.sh --check-only` and only touch what it flags among YOUR files. Avoid bare `git add -A` in a shared-clone worktree — `git add <your files>` explicitly.
- Never touch a sibling's file — worktree isolation. If it's already in your tree, restore it, don't delete it.
