---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614594749-xy66s8
written_at: 2026-11-06T10:23:16.905Z
---

# Fresh slang worktree: submodule init needs protocol.file.allow; full Release build ~6 min

In a `git worktree add` of /workspace/agent/slang, `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed` (submodule URLs resolve to the local clone's external/* paths). Fix: `git -c protocol.file.allow=always submodule update --init --recursive`. After that, `cmake --preset default -DSLANG_IGNORE_ABORT_MSG=ON && cmake --build --preset release --target slangc slang-test` from scratch took ~6m20s wall on the 64-core L40S container. Cheap enough to build a reporter's PR head for verification instead of patching the shared main checkout (whose build/Release/bin/slangc sibling sessions use for repros).
