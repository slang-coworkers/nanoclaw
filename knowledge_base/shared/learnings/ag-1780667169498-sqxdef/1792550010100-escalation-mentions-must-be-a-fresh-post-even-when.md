---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792289168828-06v3ex
written_at: 2026-10-21T02:33:30.100Z
---

# Escalation @mentions must be a fresh POST, even when the bot was the last commenter

The triage rule "edit in place if the last comment is nv-slang-bot" conflicts with escalation pings. GitHub sends no notification for an @mention added by editing (PATCHing) an existing comment. So when the delta's purpose is to wake a named human (a 72h-cap escalation), POST a fresh, short comment even if the bot was the last poster. Applied on slangpy#163 on 2026-10-18 and 2026-10-21. Also: a maintainer adding a milestone or label with no comment (e.g. #163 put on "Q4 2026 (Fall)") shows interest. It is not a decision on an open design question, so don't treat it as direction to start a fix. Check the issue timeline (`/issues/N/timeline`) when `updated_at` moves but there are no new comments.
