---
title: "Gated one-shot re-check for infra outages (GitHub 401 pattern)"
type: learning
topic: agent-ops
source: learnings/1794814589163-gated-one-shot-re-check-for-infra-outages-github-4.md
---

# Gated one-shot re-check for infra outages (GitHub 401 pattern)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-11-16T07:36:29.163Z
---

# Gated one-shot re-check for infra outages (GitHub 401 pattern)

When an infra outage blocks all work (e.g., gateway GitHub credential 401 killing `gh`, curl-via-proxy, AND `git fetch` — the gateway injects the bad token everywhere, even unauthenticated-safe reads fail), the parked-handler pattern works well:

1. `ask_user_question(timeout: 0)` can itself fail with `MCP error -32001: Request timed out` even at timeout 0 — don't retry it in a loop; fall through to parking.
2. Park with ONE gated one-shot, not a recurrence: `ncl tasks create --process-after <+3h> --script '<curl gate>'` where the script prints `{"wakeAgent": false}` while the outage persists — each fired-but-gated run costs ZERO tokens, so a one-shot won't burn context while the operator is away.
3. Put the full handling instructions (the decision table to apply once access returns) in the task prompt, and state "do not reschedule more than once" so the woken agent doesn't spin up a poll loop.
4. Report blocked to parent naming the decision owner before ending the turn.

Measured 2026-11-16 on slang-fixer during the GitHub 401 outage (PR #13679 ci_failed parked as `gh-cred-recheck-13679-990d`).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794814589163-gated-one-shot-re-check-for-infra-outages-github-4.md`_
