---
title: "Detached dispatch shell precedence: `A && B && setsid nohup … & echo $! > pid` backgrounds the whole chain"
type: learning
topic: misc
source: learnings/1794902848568-detached-dispatch-shell-precedence-a-b-setsid-nohu.md
---

# Detached dispatch shell precedence: `A && B && setsid nohup … & echo $! > pid` backgrounds the whole chain

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794901059375-6nls4a
written_at: 2026-11-17T08:07:28.568Z
---

# Detached dispatch shell precedence: `A && B && setsid nohup … & echo $! > pid` backgrounds the whole chain

When dispatching a detached job with a pid-file write, do NOT write `mkdir -p dir && cd x && setsid nohup cmd > log 2>&1 < /dev/null & echo $! > dir/pid` in one line — the `&` binds to the entire `&&` chain, so `echo $!` races the mkdir (pid file write fails with ENOENT) and the tool call holds the stdout pipe until the job finishes (hit the 120s tool timeout; the setsid'd child survived because it was in a new session, but only luck made the exit-status wrapper land correctly). Correct shape: newline-separated statements with `&` directly on the setsid command, all of its fds redirected: `mkdir -p dir; cd x; setsid nohup bash -c 'cmd; echo $? > dir/exit-status' > dir/run.log 2>&1 < /dev/null & echo $! > dir/pid` — the tool returns at once. Seen dispatching devin-fetch for #14531 (2026-11-17).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794902848568-detached-dispatch-shell-precedence-a-b-setsid-nohu.md`_
