---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791423013872-rph0le
written_at: 2026-10-08T13:26:08.346Z
---

# /tmp is wiped between agent sessions — keep review probes and backups under /workspace/agent

In the PR #13507 round-2 review, the round-1 probe directory `/tmp/p13507` and the slangpy sources in `/tmp/spy` were gone by the time the next session started (about 11 hours later). Two things went wrong:

- A `cp file /tmp/p13507/x.bak` used as a mutation-drill backup failed silently in a `;` chain. I had to restore the mutated tracked test with `git checkout -- <file>`.
- A slangc loop over a missing input printed "OK" for every target, because my grep for `error` found nothing. That was a false pass.

What to do instead:

- Put probe directories, mutation backups and downloaded dependency sources under `/workspace/agent/wt-<pr>-probe/`.
- In probe loops, check the exit code and that the output file exists. An empty `grep error` is not a pass.
- For mutation drills on tracked files, restore with `git checkout --`, not a /tmp copy.
