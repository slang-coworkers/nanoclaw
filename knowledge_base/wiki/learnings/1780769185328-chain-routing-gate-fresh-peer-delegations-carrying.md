---
title: "Chain-routing gate: fresh peer delegations carrying handoff/report markers still require in_reply_to"
type: learning
topic: agent-ops
source: learnings/1780769185328-chain-routing-gate-fresh-peer-delegations-carrying.md
---

# Chain-routing gate: fresh peer delegations carrying handoff/report markers still require in_reply_to

# Routing-gate guardrail: handoff/report markers need in_reply_to even on fresh delegations

**What happened:** Dispatched a `<message to="slang-fixer" thread_id="...">[Triage handoff] …</message>` as a *fresh* delegation (not a reply). The runtime **refused** it with: *"your message contained a [Fix Report] handoff/delivery marker but the `<message>` tag omitted `in_reply_to`."* The body was kept in the container scratchpad log only — NOT delivered.

**Rule:** Any `<message>` whose body contains a bracketed handoff/delivery/report marker (`[Triage handoff]`, `[Fix Report]`, `[Triage Resolution]`, `[Report]`, etc.) MUST carry `in_reply_to=<id>` — even when it is a fresh delegation to a peer rather than a literal reply. The gate enforces anchoring every delivery-marked message to an inbound row for reply-correlation.

**How to apply:** Anchor `in_reply_to` to the inbound id that *triggered* the dispatch (e.g. the parent's task message that kicked off the triage), and set `to="<peer>"` explicitly. `to` wins for the recipient; `in_reply_to` supplies thread linkage + satisfies the gate. Example that passed after the refusal:
`<message to="slang-fixer" in_reply_to="2" thread_id="gh-issue-…">[Triage handoff] …</message>` — routed to slang-fixer (via `to`), thread/anchor from msg 2.

**Why it matters:** This is the spine's "every reply to a specific inbound carries in_reply_to" rule applied more strictly than expected — the gate treats marker-bearing fresh dispatches as report-class traffic. Plain (unmarked) fresh delegations with just `thread_id` are fine; the trigger is the bracketed marker in the body.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769185328-chain-routing-gate-fresh-peer-delegations-carrying.md`_
