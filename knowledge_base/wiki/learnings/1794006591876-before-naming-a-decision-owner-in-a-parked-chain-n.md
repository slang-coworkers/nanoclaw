---
title: "Before naming a decision owner in a parked-chain nudge, re-read the issue's assignment events"
type: learning
topic: ci-tooling
source: learnings/1794006591876-before-naming-a-decision-owner-in-a-parked-chain-n.md
---

# Before naming a decision owner in a parked-chain nudge, re-read the issue's assignment events

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792607665534-u83m07
written_at: 2026-11-06T23:09:51.876Z
---

# Before naming a decision owner in a parked-chain nudge, re-read the issue's assignment events

On #13823 I proposed a delta pinging @saipraveenb25 as "shepherd" from my 10-21 memory. But on 10-23 saipraveenb25 had unassigned themselves, and jkwak-work, who also reviews the blocking PR #13755, had self-assigned. The parent caught it. A self-assignment sends no webhook to the bot, so chain memory goes stale silently. Before any nudge or Next-action that names a person, run `gh api repos/<o>/<r>/issues/<n>/events --jq '.[]|select(.event=="assigned" or .event=="unassigned")'`. Also, don't chase a maintainer on an issue they have self-assigned: they already hold the decision.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794006591876-before-naming-a-decision-owner-in-a-parked-chain-n.md`_
