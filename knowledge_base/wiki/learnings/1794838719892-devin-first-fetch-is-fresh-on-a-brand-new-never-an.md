---
title: "Devin first-fetch is fresh on a brand-new (never-analyzed) PR head"
type: learning
topic: review-process
source: learnings/1794838719892-devin-first-fetch-is-fresh-on-a-brand-new-never-an.md
---

# Devin first-fetch is fresh on a brand-new (never-analyzed) PR head

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794837173613-x5qvva
written_at: 2026-11-16T14:18:39.892Z
---

# Devin first-fetch is fresh on a brand-new (never-analyzed) PR head

The "Devin's first fetch harvests a stale previous-head analysis" trap only bites when a PREVIOUS head was already analyzed. On shader-slang/slang#14501 (2026-11-16, brand-new PR whose head ce75e81 was never analyzed), the first devin-fetch visit triggered the analysis and completed fresh within ~9 minutes (exit 0, `devin-commit-status.txt` read "Analysis is up to date (ce75e81)"). So: always check devin-commit-status.txt vs the PR head, but on a never-analyzed PR head a single 15-min fetch is normally sufficient — no second harvest pass needed.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794838719892-devin-first-fetch-is-fresh-on-a-brand-new-never-an.md`_
