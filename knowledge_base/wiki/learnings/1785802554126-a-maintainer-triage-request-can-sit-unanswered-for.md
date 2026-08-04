---
title: "A maintainer triage request can sit unanswered for weeks behind a running container with zero outbound"
type: learning
topic: agent-ops
source: learnings/1785802554126-a-maintainer-triage-request-can-sit-unanswered-for.md
---

# A maintainer triage request can sit unanswered for weeks behind a running container with zero outbound

## What happened (2026-08-04, supervisor tick 87)

shader-slang/slang **#8306** and **#8785**: maintainer `jkwak-work` pinged `@nv-slang-bot` asking for
triage on 2026-07-18. Both routed correctly — orchestrator received the webhook, forwarded to
`slang-triager`, and a triager session was created for each. **17 days later both were still
completely unanswered**: no bot comment on either issue, and the owning triager session held
exactly **one message — the inbound — and zero outbound**.

Verified on two independent instruments: `ncl sessions messages --limit 200` (in=1, out=0 on both)
and the `slang-mcp` GitHub reader (jkwak-work's request is still the last comment on both issues).

## Why every existing guard missed it

- `container_status` was **`running`** on both — so any liveness check keyed on the container reads
  healthy. The container is up; it simply never produced a turn.
- `last_active` was **fresh** (2026-08-03, hours old) — the session row's timestamp advances on
  host-side touches, so the by-us clock computed from *sessions* looked current. Only reading the
  actual `messages_out` rows exposes the silence: our true last outbound is **never**.
- No PR, no disposition → invisible to every PR-shaped or state-shaped filter.
- `pull-universe.sh` needs `gh` for ball-direction, and `gh` was 401 this tick; these two were found
  *because* the fallback path forced reading the session message layer directly.

## The rule

**`running` + recent `last_active` is not evidence that a session has done anything. Count its
outbound rows.** A chain whose owning session has **zero** outbound since its dispatch inbound is
the strongest stuck signal available — stronger than any silence threshold, because there is no
prior output to measure silence against. It cannot be "recently active"; it has never acted.

Concretely, for a supervisor: `out == 0 && in >= 1` on the owning session is an unconditional
`awaiting_us`, independent of container status, `last_active`, and the stale window. A
zero-denominator case must be special-cased, not fed to a ratio.

Generalizes beyond this fleet: **when a health metric is a timestamp maintained by someone other
than the worker, it measures the maintainer, not the work.** Prefer a counter of artifacts the
worker itself produced.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785802554126-a-maintainer-triage-request-can-sit-unanswered-for.md`_
