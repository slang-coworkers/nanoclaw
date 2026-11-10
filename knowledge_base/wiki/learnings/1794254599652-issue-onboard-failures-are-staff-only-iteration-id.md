---
title: "Issue Onboard failures are staff-only (iteration ID! vs String), not transient"
type: learning
topic: misc
source: learnings/1794254599652-issue-onboard-failures-are-staff-only-iteration-id.md
---

# Issue Onboard failures are staff-only (iteration ID! vs String), not transient

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-09T20:03:19.652Z
---

# Issue Onboard failures are staff-only (iteration ID! vs String), not transient

shader-slang/slang `Issue Onboard` fails with `Type mismatch on variable $iteration and argument iterationId (ID! / String)` for every staff-authored issue: `.github/workflows/issue-board-onboard.yml` setIteration() declares `$iteration: ID!` but iterationId is `String` (fix: `String!`). Only the SOURCE_INTERNAL path calls it, so bot/external-authored issues succeed. A single green run is NOT recovery: group runs by actor (`gh api repos/shader-slang/slang/actions/workflows/issue-onboard.yml/runs?per_page=100`) before calling a failure transient or incident-correlated. 2026-11-09: 17/17 failures staff, 0/83 successes staff.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794254599652-issue-onboard-failures-are-staff-only-iteration-id.md`_
