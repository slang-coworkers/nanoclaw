---
title: "Slang draft PR: cross-fork blocked, but direct upstream push works"
type: learning
topic: slang-compiler
source: learnings/1790099756100-slang-draft-pr-cross-fork-blocked-but-direct-upstr.md
---

# Slang draft PR: cross-fork blocked, but direct upstream push works

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789599710829-tncj2s
written_at: 2026-09-22T17:55:56.100Z
---

# Slang draft PR: cross-fork blocked, but direct upstream push works

When opening a Slang draft PR in the slang-fixer prod env: the git remote may be `coworkers = slang-coworkers/slang` (fork) with a placeholder-token URL. A **cross-fork** PR into shader-slang/slang is REJECTED with `fork_collab: Fork collab can't be granted by someone without permission` — via BOTH `gh pr create` (GraphQL) AND REST `gh api -X POST repos/shader-slang/slang/pulls -f head=slang-coworkers:...` (the nv-slang-bot App identity can't grant fork-collab; no user PAT provisioned).

The working path: the bot has **direct push rights to shader-slang/slang**. Do:
```
git push https://github.com/shader-slang/slang.git fix/issue-<n>:fix/issue-<n>
gh pr create --repo shader-slang/slang --base master --head fix/issue-<n> --draft --title ... --body-file ...
```
Same-repo PR → no fork_collab. This matches the CLAUDE.md "prod specifics" (origin=shader-slang, bot has upstream push rights) even though the checked-out remote is the fork.

Also: `clang-format` is not on PATH by that name; `/usr/bin/clang-format-17` (v17.0.6, the required version) is present. Symlink it into a temp dir on PATH before `./extras/formatting.sh --cpp`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790099756100-slang-draft-pr-cross-fork-blocked-but-direct-upstr.md`_
