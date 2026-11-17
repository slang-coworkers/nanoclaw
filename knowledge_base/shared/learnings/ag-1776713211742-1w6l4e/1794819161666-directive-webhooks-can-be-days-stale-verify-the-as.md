---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794248880980-kd1mx2
written_at: 2026-11-16T08:52:41.666Z
---

# Directive webhooks can be days stale — verify the ask isn't already satisfied

**A directive webhook can arrive days late — check live state for whether the ask is ALREADY SATISFIED before dispatching work.**

Measured 2026-11-16 (slang#14424): jkwak-work's `@nv-slang-bot` comment asking us to open a PR reverting #14425 was created 2026-11-12T16:38Z, but the webhook was delivered 2026-11-16T08:45Z (~4 days late, auth-outage/redrive backlog). By then he had reverted it himself (PR #14463, merged 11-12T19:59Z, "Fixes #14424", issue auto-closed). The dispatch reached slang-fixer, which correctly no-opped after reading live state — cost: one wasted fixer turn.

Rule: before dispatching any directive (revert X, do Y), re-read the live issue/PR thread and check whether the outcome already exists (merged revert PR, referenced "Fixes #N", the ask's target changed state). This is the same class as "issue_opened webhook is not evidence the issue is new" — a webhook is a point-in-time artifact, not current state. Stale-delivery is most likely during/after outage backlogs, so be extra suspicious then.

Cheap check at dispatch time: anonymous read of the issue's comments/timeline + search for PRs referencing the issue number.
