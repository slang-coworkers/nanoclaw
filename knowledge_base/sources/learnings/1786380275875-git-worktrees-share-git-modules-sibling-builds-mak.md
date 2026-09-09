---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-10T16:44:35.875Z
---

# Git worktrees SHARE .git/modules — sibling builds make 14 submodule pointers look like YOUR uncommitted change

## TL;DR
In a repo with submodules, `git worktree add` does **not** give the new worktree its own submodule
storage — all worktrees share `<mainrepo>/.git/modules/`. So when a *sibling* worktree checks out
different submodule commits (any build that runs `git submodule update`), **your** worktree reports
those gitlinks as ` M external/<name>` in `git status`, with a `-dirty` suffix in `git diff`.

Measured (slang, 2026-08-10, `wt-slang-12443` on `fix/issue-12443`):
- `git diff --stat` listed **14 `external/*` submodule bumps** I never touched, alongside my 2 real files.
- `git rev-parse --git-dir` ⇒ `/workspace/agent/slang/.git/worktrees/wt-slang-12443`; the shared
  `ls /workspace/agent/slang/.git/modules` ⇒ `external`. One storage, N worktrees.
- Discriminator that settles it, per submodule:
  `git rev-parse HEAD:external/glslang` (what my commit records: `d1f52c8993`) vs
  `git -C external/glslang rev-parse HEAD` (what is checked out: `90afccfbd4`). Different ⇒ the
  gitlink is dirty from *someone else's* checkout, not from an edit of mine.

## Why it matters
`git add -A` / `git commit -a` would have swept all 14 pointer bumps into a one-line compiler fix —
a submodule-rolling PR masquerading as a bug fix, and exactly the kind of diff a reviewer bounces.
It is also *silent*: nothing warns you, and the paths look plausibly build-related.

## How to apply
- **Never `git add -A` in a shared-submodule worktree.** Stage explicit paths:
  `git add source/... tests/... docs/...`, then verify with `git diff --cached --stat` that ONLY
  your paths appear.
- Scope every status/diff you reason about: `git status --porcelain -- source tests docs`.
- Before believing a submodule pointer is yours, run the HEAD-vs-checked-out pair above. Do **not**
  "fix" it by committing, and do **not** `git submodule update` to make it go away — that mutates
  state a sibling build is actively using (worktree-isolation rule: you may see siblings, never
  touch them).
- Corollary for the workflow's `git add -A && git commit`: that instruction is unsafe in any repo
  with submodules plus concurrent worktrees. Prefer explicit paths.
