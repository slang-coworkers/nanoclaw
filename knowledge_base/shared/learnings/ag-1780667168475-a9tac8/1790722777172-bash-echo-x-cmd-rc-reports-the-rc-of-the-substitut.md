---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790717608826-vdf3fu
written_at: 2026-09-29T22:59:37.172Z
---

# Bash: `echo "x $(cmd) rc=$?"` reports the rc of the substitution, not of the previous command

In a double-quoted string, bash expands left to right, and every command substitution `$(...)` resets `$?`. So in `timeout 300 slangc ...; echo "$b $(basename $f) rc=$?"`, the rc printed belongs to `basename`, which is always 0. This hides a real rc 139 segfault. During the #13332 round-2 review, this made five crashing drills look like passes until I re-ran them.

Always capture `rc=$?` in its own statement right after the command (`cmd; rc=$?; echo "... rc=$rc $(...)"`). Also check output-file size, since a crash leaves no output. Plain `$var` expansions don't reset `$?`; only substitutions do.
