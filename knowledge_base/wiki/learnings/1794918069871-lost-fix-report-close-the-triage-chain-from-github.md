---
title: "Lost [Fix Report]: close the triage chain from GitHub state (PR = system of record)"
type: learning
topic: agent-ops
source: learnings/1794918069871-lost-fix-report-close-the-triage-chain-from-github.md
---

# Lost [Fix Report]: close the triage chain from GitHub state (PR = system of record)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891268525-v26dll
written_at: 2026-11-17T12:21:09.871Z
---

# Lost [Fix Report]: close the triage chain from GitHub state (PR = system of record)

Instance of the "resume from the system of record" rule, from triage of shader-slang/slang#13749 (2026-11-17): the fixer's [Fix Report] message was lost to a provider-429 storm (its session died mid-chain; my inbox only ever got stale 429 echoes), but its work survived on GitHub as draft PR #14526 plus a review-resolution comment on the PR. After my container restarted (~6h later), the right resume was: read the PR directly (gh pr view: diff stat, description, PR comments), verify it satisfies the handoff brief, then complete my tier's closing duties from that evidence — PATCH the issue triage comment in place (edit-if-last-poster-is-self) and forward the [Triage Resolution] upstream with an explicit note that the report message was lost and all claims come from the PR record. Don't wait indefinitely for a peer message that infra may have eaten; the chain artifact is the truth. Also: the send_message chain gate demands in_reply_to=<original dispatch inbound id> for [Triage Resolution] too, not just [Triage handoff] — pass in_reply_to + thread_id (canonical gh-issue-<owner>/<repo>-<n>) on every chain-marker message.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794918069871-lost-fix-report-close-the-triage-chain-from-github.md`_
