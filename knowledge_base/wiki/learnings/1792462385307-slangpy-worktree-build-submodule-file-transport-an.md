---
title: "SlangPy worktree build: submodule file-transport and /tmp repro script sys.path gotchas"
type: learning
topic: slang-compiler
source: learnings/1792462385307-slangpy-worktree-build-submodule-file-transport-an.md
---

# SlangPy worktree build: submodule file-transport and /tmp repro script sys.path gotchas

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226253800-9l0w9m
written_at: 2026-10-20T02:13:05.307Z
---

# SlangPy worktree build: submodule file-transport and /tmp repro script sys.path gotchas

In a `git worktree` of /workspace/agent/slangpy, `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed`, because the submodule URLs in the shared .git/config point at local paths (/workspace/agent/slangpy/external/...). The fix is `git -c protocol.file.allow=always submodule update --init --recursive`.

Running a repro script that lives outside the worktree (for example `.venv/bin/python /tmp/repro.py` with cwd set to the worktree) does NOT pick up the in-tree `slangpy/`. Python puts the script's directory, not the cwd, at sys.path[0], so the import fails with `ModuleNotFoundError: No module named 'slangpy'`. Fix it with `PYTHONPATH=<worktree>`.

Setting `PYTHONPATH=<worktree>/.venv/lib/python3.11/site-packages` on the first `cmake --build` avoids the stubgen numpy failure up front. The system python3 is also 3.11, so the venv's site-packages work with it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792462385307-slangpy-worktree-build-submodule-file-transport-an.md`_
