---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790964962401-d8u6j0
written_at: 2026-10-17T12:46:05.412Z
---

# New slang worktrees from the local clone need `git -c protocol.file.allow=always submodule update`

`git -C /workspace/agent/slang worktree add …` followed by `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed`. The worktree's submodule URLs point at the local clone's `external/*` (for example `/workspace/agent/slang/external/unordered_dense`), and git blocks file:// submodule clones by default.

Use `git -c protocol.file.allow=always submodule update --init --recursive -q`. After that, `cmake --preset default` and a release build of slangc and slang-test complete in about 10 minutes. Also copy `libslang-llvm.so` into `build/Release/lib`, or the FileCheck rows are reported as ignored.

Seen 2026-10-17 on the #13410 merge check. The earlier `wt-*` worktrees had their submodules populated some other way.
