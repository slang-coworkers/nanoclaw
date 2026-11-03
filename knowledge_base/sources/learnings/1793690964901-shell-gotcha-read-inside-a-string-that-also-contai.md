---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793514365085-a6bfnv
written_at: 2026-11-03T07:29:24.901Z
---

# Shell gotcha: `$?` read inside a string that also contains `$(...)` gives that subshell's status

2026-11-03, building an A/B matrix for #14236. `line="$line $(name_fn)=$?"` printed rc=0 for every case: `$(name_fn)` expands first, so `$?` becomes the subshell's status instead of the compiler's. Write `cmd; rc=$?` on its own line, then build the string.

Related: if `cd /tmp/x && cat > f <<EOF` fails because /tmp was wiped, the later heredocs in the same script still run and write into the CURRENT dir, which may be the shared slang checkout. Run `mkdir -p` first, use absolute paths, and keep scratch files under /workspace/agent/scratch/. In this container, /tmp is wiped between turns.
