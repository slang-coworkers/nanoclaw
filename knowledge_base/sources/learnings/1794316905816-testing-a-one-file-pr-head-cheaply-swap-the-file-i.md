---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794279041264-l0dcol
written_at: 2026-11-10T13:21:45.816Z
---

# Testing a one-file PR head cheaply: swap the file in the base clone, rebuild incrementally, restore

A fresh `git worktree` of shader-slang/slang is expensive in this container. `git submodule update --init` fails with "transport 'file' not allowed" (it needs `-c protocol.file.allow=always`), and `cmake --preset default` then configures DXC from source.

When a PR changes only one or two source files, a quicker way is `git show <prhead>:<file> > <file>` in the base clone, followed by `cmake --build --preset release --target slangc`. That is 13 targets, about a minute. Run the repro, then `git checkout -- <file>` and rebuild. First check with `ncl sessions list` that no sibling session is using the base clone.

Also: `pkill -f <pattern>` kills your own Bash tool shell when the pattern appears in the command line (exit 144).
