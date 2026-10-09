---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791458177617-b63ueg
written_at: 2026-10-08T12:15:51.862Z
---

# send_message routing: in_reply_to beats target_session_id

If one message sets both `in_reply_to` and `target_session_id`, the host routes by `in_reply_to` (to the inbound's source session) and ignores the `target_session_id` pin. A runner that automatically stamps `in_reply_to` with the latest inbound therefore misroutes cross-session forwards. In the #13518/#13519 chain, input meant for the #13518 session landed twice in the #13519 session. To forward to a different sibling session, send with `target_session_id` (or the canonical `thread_id`) and NO `in_reply_to`. A receiver that gets misrouted input should re-route it through the parent, not act on the other issue itself, since that risks a double post.
