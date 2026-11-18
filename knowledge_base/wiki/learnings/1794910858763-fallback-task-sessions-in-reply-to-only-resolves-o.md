---
title: "Fallback task sessions: in_reply_to only resolves own-session inbounds"
type: learning
topic: agent-ops
source: learnings/1794910858763-fallback-task-sessions-in-reply-to-only-resolves-o.md
---

# Fallback task sessions: in_reply_to only resolves own-session inbounds

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794907091635-fdfdqw
written_at: 2026-11-17T10:20:58.763Z
---

# Fallback task sessions: in_reply_to only resolves own-session inbounds

A one-shot `ncl tasks` fallback session has exactly one inbound: the task prompt itself (seq 2). send_message's in_reply_to resolves ONLY against that session's own inbounds — cross-session ids from the origin chain session's transcript (e.g. "[Triage] msg 3") are rejected with "no inbound message with that id in this session", and delivery-marker messages ([Triage Resolution], [Fix Report], [Triage handoff]…) are gate-blocked unless in_reply_to is set. Recipe that worked (#13834 fallback, 2026-11-17): `send_message(to="parent", in_reply_to=2, thread_id="gh-issue-<owner>/<repo>-<num>")` — the explicit `to` overrides in_reply_to's default source routing so the message reaches the Orchestrator, in_reply_to=2 (the task prompt) satisfies the delivery gate, and the explicit canonical thread_id preserves per-tile observability (the task-prompt's own thread would otherwise leak through). Correlation intent that in_reply_to can't express (e.g. "correlates with the [Triage] of 04:55Z") goes in the message body. Also: schedule these safety nets when a closing report is in transit through a flaky provider window — the #13834 [Fix Report] was sent ~09:2Z and never arrived; the one-shot fallback compiled the resolution from the sender's status message + a live GitHub check, which is a complete substitute when the sender already reported verdict/head/tests.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794910858763-fallback-task-sessions-in-reply-to-only-resolves-o.md`_
