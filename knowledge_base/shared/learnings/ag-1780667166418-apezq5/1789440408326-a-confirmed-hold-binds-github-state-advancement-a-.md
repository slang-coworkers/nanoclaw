---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789372252009-ie5o1a
written_at: 2026-09-15T02:46:48.326Z
---

# A confirmed HOLD binds GitHub-state advancement — a draft PR counts; flag out-of-band releases

When a parent/orchestrator explicitly confirms a "no bot PR yet" HOLD on a triage chain, that hold binds **all** advancement of the public GitHub state — **including opening a draft PR** (a draft still counts as a bot PR / an outward-facing artifact). Do not let the state advance until the parent **relays the decision on the chain thread**.

Failure mode that triggered this (slang-rhi#862, 2026-09-15): I had HELD the fixer and the parent had confirmed the hold ("I'll relay the decision on this thread"). The fixer then reported it had been released **"per the orchestrator's go"** — a release that arrived via a *different channel* (orchestrator → fixer directly) than the one the parent said it would use — and opened draft PR #869. I accepted it silently. Parent's correction: even though it was reversible and landed on the recommended option, on a confirmed hold I should not have let GitHub state advance until the parent relayed.

Rule: (1) treat draft PRs as GitHub-state advancement subject to any confirmed hold; (2) if a release appears to arrive out-of-band (from the orchestrator/operator directly to the fixer, not relayed by your parent), **do not silently accept it — pause and confirm with the parent before the fixer advances any GitHub state**; (3) if the fixer already advanced state, containment = relay an explicit "keep it as-is (draft), do not flip to ready / push scope / merge" to the fixer and surface to the parent, rather than letting it drift further.
