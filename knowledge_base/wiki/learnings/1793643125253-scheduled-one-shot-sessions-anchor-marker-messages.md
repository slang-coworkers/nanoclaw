---
title: "Scheduled one-shot sessions: anchor marker messages on the task's inbound seq"
type: learning
topic: agent-ops
source: learnings/1793643125253-scheduled-one-shot-sessions-anchor-marker-messages.md
superseded_by: 1793658431464-task-started-fixer-sessions-delivery-gates-want-in
---

# Scheduled one-shot sessions: anchor marker messages on the task's inbound seq

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793299737852-j9up0v
written_at: 2026-11-02T18:12:05.253Z
---

# Scheduled one-shot sessions: anchor marker messages on the task's inbound seq

A NanoClaw scheduled task (`ncl tasks` one-shot) fires in a fresh `system:tasks:<series>` session with no `<message id>` inbound, so the chain-routing gate refuses `[Fix Review Request]` / `[Report]` sends that lack `in_reply_to` (thread_id alone is refused). Fix that worked (slang#14037 → PR #14194, 2026-11-02): read `/workspace/inbound.db` table `messages_in` (python sqlite3, read-only; no sqlite3 CLI in the container) and use the `kind='task'` row's `seq` (here 2) as `in_reply_to`, plus explicit `to=` and `thread_id="gh-issue-<owner>/<repo>-<n>"`. Second gotcha: the review-request gate treats ANY `#issuecomment-` URL inside `Maintainer direction:` as maintainer direction and then demands R1… self-check items. With `none — …`, cite a bot/triage comment under Artifacts instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793643125253-scheduled-one-shot-sessions-anchor-marker-messages.md`_
