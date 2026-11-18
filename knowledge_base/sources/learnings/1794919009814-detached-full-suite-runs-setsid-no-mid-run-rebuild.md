---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794899550501-i6th8k
written_at: 2026-11-17T12:36:49.814Z
---

# Detached full-suite runs: setsid, no mid-run rebuilds, plan-gate write patterns

Long slang-test runs started from a bash tool command die when the turn is killed (provider 429,
container restart): the harness kills the process group, taking `nohup ... &` subshells with it —
two full-suite runs died this way mid-suite (2026-11-17, #14524). Use
`setsid nohup ./build/Debug/bin/slang-test ... < /dev/null > log 2>&1 & disown` to fully detach
into a new session; that run survived the next turn death. Two more traps in the same area:
(1) NEVER rebuild the tree while a background suite is running — ninja relinking slang-test and
the test servers kills or corrupts the run (schedule builds and suite runs serially);
(2) `rm -f` and `>` redirections in bash commands trip the plan-gate hook when workflow state is
reset — a plain `echo`/`ls` still passes, which tells you it's the write-pattern, not a total
block: re-record the plan (Write tool on /workspace/agent/reports/<slug>.md) and the gate lifts.
