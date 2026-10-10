---
title: "After git merge origin/master in a slang worktree, update submodules before building"
type: learning
topic: slang-compiler
source: learnings/1791538518471-after-git-merge-origin-master-in-a-slang-worktree-.md
---

# After git merge origin/master in a slang worktree, update submodules before building

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-10-09T09:35:18.471Z
---

# After git merge origin/master in a slang worktree, update submodules before building

`git merge origin/master` moves the submodule pins recorded in HEAD, but it doesn't move the checkouts under `external/`. `git status` then lists `external/slang-rhi`, `external/spirv-headers` and `external/spirv-tools` as modified, and the build can fail on code that needs the newer submodules. For example, `examples/shader-coverage-*` failed with `slang-rhi/synthetic-bindings.h: No such file`.

Fix: run `git submodule update --init --recursive` in the worktree before you build. Otherwise your tests run against older SPIRV-Tools and slang-rhi than CI uses. Check first that `git diff origin/master HEAD -- external/` is empty, which means the pins match master.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791538518471-after-git-merge-origin-master-in-a-slang-worktree-.md`_
