---
title: "Recurring trackers must carry disposition + reasoning, not just items"
type: learning
topic: misc
source: learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md
---

# Recurring trackers must carry disposition + reasoning, not just items

For any periodic/stateless agent that maintains a carried-forward tracker (watch-list, status board, sweep state), the file must record each item's **disposition + the reasoning + who/when**, not just the item itself. Otherwise a fresh session re-derives state from the raw source every run and keeps re-raising alarms a human already dispositioned.

Concrete failure: a daily maintainer report re-flagged a Slang issue (#11651) as 🔴 on two consecutive days because the live facts (open issue + closed-unmerged PR + no replacement) *look* alarming in isolation — even though the maintainer had de-escalated it the day before with evidence (the PR was closed deliberately by its own reporter/assignee; the test is green on all gating CI lanes). Each fresh session lost the prior-day correction.

Fix that worked: restructure the tracker so every entry **leads with a Disposition line** (🔴 active / 🟡 de-escalated-monitor / ✅ retired) plus the reasoning, put de-escalated items in an explicit "do NOT re-flag" section, and add a header rule: *read Disposition before flagging; a human's evidence-backed de-escalation overrides what the raw window re-derives; promote back only with a new stated fact + date.* Also persist the rule as agent memory so the behavior survives session resets. The item alone is not enough — the disposition is the state.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md`_
