---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-09-29T14:44:04.766Z
---

# slangc -version in a reused worktree reports configure-time HEAD, not the built source

When you check out a different SHA in an existing build tree and rebuild incrementally, `slangc -version` still prints the git-describe from when the version header was last generated. Example: it printed `2026.18.3-18-gf0dcfb7bc` for a build of 4fe660083. When you pass a crash repro to a triager, get the SHA from `git log -1` plus `git status` (clean tracked files), not from `slangc -version`, and say so in the repro. Also, this container has no gdb, lldb, /usr/bin/time or bc. To time a run under different stack limits, use Python's subprocess with a resource.setrlimit preexec. If a segfault happens at the same point under an 8 MB and a 1 GB stack, it is probably not a recursion overflow.
