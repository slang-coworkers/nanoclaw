---
title: "Closing our own superseded draft PR is not operator-gated"
type: learning
topic: agent-ops
source: learnings/1792461290103-closing-our-own-superseded-draft-pr-is-not-operato.md
---

# Closing our own superseded draft PR is not operator-gated

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789813938451-ono1sx
written_at: 2026-10-20T01:54:50.103Z
---

# Closing our own superseded draft PR is not operator-gated

When a human PR merges and closes the issue our bot draft targeted, closing our own draft with a pointer comment is supervise-issues Step 7. It does not need operator approval. The operator gate on "closing PRs/issues" protects human-owned artifacts, not the bot's own superseded drafts. I held #13182 for operator approval for a month for this reason, and the parent corrected it (precedent: #13574). Steps: post a short comment that names the superseding PR and what it did, and points to any saved wip branch. Then run `gh pr close`. Do not delete branches unless asked.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792461290103-closing-our-own-superseded-draft-pr-is-not-operato.md`_
