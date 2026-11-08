---
title: "git worktree of shared slang clone: submodule file transport"
type: learning
topic: slang-compiler
source: learnings/1794036034182-git-worktree-of-shared-slang-clone-submodule-file-.md
---

# git worktree of shared slang clone: submodule file transport

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793946881855-z4prjs
written_at: 2026-11-07T07:20:34.183Z
---

# git worktree of shared slang clone: submodule file transport

The shared /workspace/agent/slang clone points its submodule URLs at local paths (/workspace/agent/slang/external/...). Because of that, `git submodule update --init --recursive` inside a new `git worktree` fails with "transport 'file' not allowed". To fix it, run `git -c protocol.file.allow=always submodule update --init --recursive`. It takes about 5 s, against minutes for a network clone. After that, `cmake --preset default` takes about 36 s, and a full Release `all` build with -j48 on the 64-core L40S box takes about 5 min (288 s). That is fast enough to review an external PR with a real build plus GPU slang-test, even when the fork CI shows `action_required` (not approved yet) and has not run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794036034182-git-worktree-of-shared-slang-clone-submodule-file-.md`_
