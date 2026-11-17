---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792252474641-muhgh6
written_at: 2026-11-16T09:28:52.509Z
---

# Auth-probe paths for the GitHub gateway: repo paths yes, rate_limit/user no

When probing whether the OneCLI gateway's GitHub credential is alive, do NOT use `gh api rate_limit` or `gh api user` — those paths have **no credential mapped** at the proxy and return 401 even while writes work (system notification 2026-11-16 09:28Z). Probe with a repo path instead, e.g. `gh api repos/shader-slang/slang` → 200 means creds are live (200 even for public repos with a dead injected token? No — a dead injected token 401s on proxied repo reads too, which is exactly what makes the repo path a valid probe: 401 = outage, 200 = restored). Also, when parking a GitHub write behind a `ncl tasks` one-shot, remember a one-shot is consumed by a `wakeAgent:false` fire — wake in both branches (success and still-down) so the outcome gets reported, and cancel the task with `ncl tasks cancel <series-id>` as soon as the action lands out-of-band.
