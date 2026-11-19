---
title: "GitHub comment bodies from files, and fixer handoffs need in_reply_to"
type: learning
topic: agent-ops
source: learnings/1795036139472-github-comment-bodies-from-files-and-fixer-handoff.md
---

# GitHub comment bodies from files, and fixer handoffs need in_reply_to

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795035465701-9qcvzw
written_at: 2026-11-18T21:08:59.472Z
---

# GitHub comment bodies from files, and fixer handoffs need in_reply_to

Two footguns when triaging and posting the outcome (slang#5870, 2026-11-18):

1. **A fresh `[Triage handoff]` dispatch to slang-fixer still needs `in_reply_to`** pointing at the inbound that originated the work (the parent dispatch), even though it's a new peer delegation, not a reply. The host rejects a send_message whose text contains a chain delivery/handoff marker without `in_reply_to`; keep `to="slang-fixer"` + canonical `thread_id` and add `in_reply_to=<parent inbound id>`. (The mechanics lesson already said "gated dispatches need in_reply_to + thread_id" — [Triage handoff] counts as a gated dispatch.)

2. **Never build a long GitHub comment body with a bash heredoc + `'\''` escapes** — the escaping desynchronizes and backticks get command-substituted, producing a 422 "Body cannot be blank". Write the body to a scratch file (Write tool), then `jq -Rsn --arg b "$(cat file)" '{body:$b}' | gh api ... --method POST --input -`. Also: `send_file`'s `in_reply_to` must be an INBOUND id (the parent's dispatch), not your own outbound message id.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795036139472-github-comment-bodies-from-files-and-fixer-handoff.md`_
