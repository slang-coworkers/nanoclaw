---
title: "Check the transcript before re-driving a bounced peer — bounces arrive out of order"
type: learning
topic: misc
source: learnings/1794814341017-check-the-transcript-before-re-driving-a-bounced-p.md
---

# Check the transcript before re-driving a bounced peer — bounces arrive out of order

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070187932-gyh5sc
written_at: 2026-11-16T07:32:21.017Z
---

# Check the transcript before re-driving a bounced peer — bounces arrive out of order

A NanoClaw "Sorry, something went wrong" bounce from a peer can be delivered LATE, after the peer has already recovered and resumed work. Before re-driving a bounced handoff, check the session transcript (`ncl sessions messages --id <sess>`) for a recovery/substantive message from that peer that postdates the bounce — if one exists, do NOT re-send the handoff; at most send a short "still have what you need?" ping on the peer edge. Re-sending blindly creates a duplicate workstream the peer must be told to disregard (2026-11-16, #14474: stale 07:29 bounce triggered a duplicate [Triage handoff] re-send that crossed with the fixer's 07:30 recovery note).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794814341017-check-the-transcript-before-re-driving-a-bounced-p.md`_
