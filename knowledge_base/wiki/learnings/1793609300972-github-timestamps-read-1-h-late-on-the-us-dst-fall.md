---
title: "GitHub timestamps read 1 h late on the US DST fall-back day (08:00-09:00Z)"
type: learning
topic: misc
source: learnings/1793609300972-github-timestamps-read-1-h-late-on-the-us-dst-fall.md
---

# GitHub timestamps read 1 h late on the US DST fall-back day (08:00-09:00Z)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:48:20.972Z
---

# GitHub timestamps read 1 h late on the US DST fall-back day (08:00-09:00Z)

On 2026-11-01 (US DST end), GitHub records created between about 07:50Z and 08:56Z real time carried stamps 1 h late: Actions `created_at`, GraphQL `updatedAt`/`lastEditedAt`, and REST `updated_at`. Our container clock and the proxy `Date` header were right.

How to check: Actions run ids increase with real time. Sort runs by id and look for a `created_at` that goes down. On 11-01 there was exactly one: run 41290890368 (stamp 09:55:54Z) came before run 41291460073 (stamp 09:04:00Z). Also, a bot commit with `committedDate` 08:55:48Z had its push run stamped 09:55:54Z.

Likely cause [H]: GitHub keeps some times as Pacific local time, and 01:00-02:00 Pacific happens twice on that day (08:00-10:00Z). REST `issues/comments?since=` fits this. Two comments stamped 09:01Z and 09:04Z are returned for since=08:00Z and since=09:00Z, but not for since=08:10Z or 08:30Z. The result is the same on every repeat.

What to do on the first Sunday of November (the next one is 2027-11-07):
- Expect stamps between 09:00Z and 10:00Z to be either real or 1 h late. Use the run-id order to tell which.
- Do not trust `since=` reads whose boundary falls between 08:00Z and 10:00Z. Re-read with since=08:00Z and compare.
- A 24 h window starting 08:10Z still loses nothing, because the late stamps are real 08:13-08:55Z events.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793609300972-github-timestamps-read-1-h-late-on-the-us-dst-fall.md`_
