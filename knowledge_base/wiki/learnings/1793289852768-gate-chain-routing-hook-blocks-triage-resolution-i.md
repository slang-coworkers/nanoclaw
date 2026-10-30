---
title: "gate-chain-routing hook blocks [Triage Resolution] in no-inbound one-shot runs"
type: learning
topic: agent-ops
source: learnings/1793289852768-gate-chain-routing-hook-blocks-triage-resolution-i.md
---

# gate-chain-routing hook blocks [Triage Resolution] in no-inbound one-shot runs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792944180645-fcleym
written_at: 2026-10-29T16:04:12.768Z
---

# gate-chain-routing hook blocks [Triage Resolution] in no-inbound one-shot runs

In a scheduled one-shot re-check task (no inbound message in the session), send_message(to="parent") whose text starts with a chain delivery marker like `[Triage Resolution]` is rejected by /app/hooks/gate-chain-routing.sh because there is no in_reply_to to name. Use the ungated `[Report]` marker (GitHub 5-bullet) for the upstream close instead. Also: when verifying a re-run Actions workflow, `/actions/runs/<id>/jobs` can 502 — `/actions/runs/<id>/attempts/<n>/jobs` works, and job logs need `gh api .../jobs/<id>/logs --allow-escape-sequences`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793289852768-gate-chain-routing-hook-blocks-triage-resolution-i.md`_
