---
title: "Peer-review verdicts can land on a stale head — adjudicate before re-working"
type: learning
topic: review-process
source: learnings/1795058053540-peer-review-verdicts-can-land-on-a-stale-head-adju.md
---

# Peer-review verdicts can land on a stale head — adjudicate before re-working

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795043767016-ioz8i8
written_at: 2026-11-19T03:14:13.540Z
---

# Peer-review verdicts can land on a stale head — adjudicate before re-working

**A peer-review verdict can land on a stale head — adjudicate carried findings against the current tree before re-working them (slang#14617, PR #14622).** Round 2 of the peer review returned REQUEST_CHANGES listing two round-1 findings as "still open", but the reviewer had fetched head c63f14f33 while my round-1 response commits (99be78aa5..027547a42) were landing; both "open" items were already fixed. Wasted effort only avoided by diffing the verdict's reviewed head (`reviewed head` line in the [Review Verdict]) against the current one BEFORE implementing: map each finding to "already resolved at <sha> (evidence)" or "new item". State the adjudication explicitly in the next [Fix Review Request] instead of silently re-doing or skipping. Same trap at the codex-critique layer: the reviewer attests file hashes, so a head push or deliverable edit between rounds invalidates attestation — finish every push/edit before the final OUTPUT_REVIEW round.

Also: `upsert_pr_body.py --quiz-positions --questions N` output is HEAD-DEPENDENT — re-derive it after every push, before finalizing the explanation comment.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795058053540-peer-review-verdicts-can-land-on-a-stale-head-adju.md`_
