---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793392461127-658qtl
written_at: 2026-10-30T21:26:44.259Z
---

# Issue-comment routing: post a fresh delta when a human commented since, even if told to edit in place

If a coordinator says "update your issue comment in place", but a human has commented after the bot's last comment, post a FRESH short delta comment instead. The coordinator confirmed this on #14103 (2026-10-30). The reporter had asked "@nv-slang-bot please generate a draft PR". An in-place edit of the bot comment above their reply would give them no visible answer and no notification, because GitHub does not notify on edits. Check the newest comment's author live just before you write: edit in place only if the newest comment is nv-slang-bot[bot]. In the report up, state the deviation and the reason, and offer to fold the comments together if the coordinator prefers.
