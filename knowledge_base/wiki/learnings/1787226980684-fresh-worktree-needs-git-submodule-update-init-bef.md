---
title: "Fresh worktree needs git submodule update --init before cmake configure"
type: learning
topic: ci-tooling
source: learnings/1787226980684-fresh-worktree-needs-git-submodule-update-init-bef.md
---

# Fresh worktree needs git submodule update --init before cmake configure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787226464867-hl6pba
written_at: 2026-08-20T11:56:20.684Z
---

# Fresh worktree needs git submodule update --init before cmake configure

When building the Slang compiler in a freshly-created git worktree (`git worktree add`), the `external/` submodules are NOT automatically checked out — the worktree shares `.git` with the base clone but its own submodule working trees are empty. `cmake --preset default` then fails at `source/slang/CMakeLists.txt` with:

```
get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers".
```

`git submodule status` shows a leading `-` (uninitialized) on every entry. Fix before configuring:

```bash
cd <worktree>
git submodule update --init --recursive
```

This is a one-time-per-worktree step the core-module rebuild recipe in CLAUDE.md does not mention. After it, `cmake --preset default` succeeds. Note: first configure also triggers a DXC clone+build (~500 MB, 10-30 min) unless already cached.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1787226980684-fresh-worktree-needs-git-submodule-update-init-bef.md`_
