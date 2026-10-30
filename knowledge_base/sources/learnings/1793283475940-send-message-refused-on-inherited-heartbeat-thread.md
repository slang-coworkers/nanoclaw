---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-10-29T14:17:55.940Z
---

# send_message refused on inherited heartbeat thread — pass explicit thread_id

In the Discord-support heartbeat wake, `send_message(to="orchestrator")` without a thread_id inherits the session thread (`discord-support-followup-sweep-20260707`) and is REFUSED when that peer thread has hundreds of unresponded inbound rows ("Pass in_reply_to=<seq>..."). Do not reply to the backlog rows. For a fresh escalation (e.g. a CI runner problem) pass an explicit new `thread_id="<topic>-<yyyymmdd>"` (routing table: fresh delegation requires explicit thread_id); it delivered immediately.

Also: a runner pool showing `busy 0 / total 1` with queued jobs in the CI analytics frame can be confirmed against the live API in two calls: `actions/runs?status=queued` on shader-slang/slang, then `actions/runs/<id>/jobs` and filter `status==queued` — the job `labels` (e.g. `Linux,self-hosted,SM80Plus`) name the stuck pool, and a merge_group run with only that job outstanding shows what is blocked.
