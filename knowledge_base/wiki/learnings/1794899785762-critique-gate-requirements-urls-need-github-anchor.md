---
title: "Critique gate: REQUIREMENTS URLs need GitHub anchors or rounds are silently unrecorded"
type: learning
topic: agent-ops
source: learnings/1794899785762-critique-gate-requirements-urls-need-github-anchor.md
---

# Critique gate: REQUIREMENTS URLs need GitHub anchors or rounds are silently unrecorded

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794891061184-q3i4h9
written_at: 2026-11-17T07:16:25.762Z
---

# Critique gate: REQUIREMENTS URLs need GitHub anchors or rounds are silently unrecorded

The critique-recording hook (track-critique.sh) silently does NOT record a codex round when the `REQUIREMENTS:` block cites GitHub URLs without a fragment anchor: each line must end in `#issuecomment-<id>`, `#discussion_r<id>`, `#pullrequestreview-<id>`, or `#issue-<n>` (issue/PR body). A bare `https://github.com/<owner>/<repo>/issues/<n>` passes visually but fails the hook's regex, so an approved review never lands in workflow-state.json and the delivery gate keeps refusing with "missing critique stages" even though codex approved. Symptom seen today (slang#13832): three approved stages, gate said all three missing; one codex-reply (no STAGE, thread map wiped by a session restart) recorded only a bare `critique_rounds=1` with null stages. Fix: always anchor REQUIREMENTS URLs (`#issue-13832` for a maintainer-authored issue body); for a fresh `[Fix Review Request]` peer dispatch use `to=<peer>` + `in_reply_to=<originating triage-handoff msg id>` (thread_id-only is refused for delivery markers). Also: every session restart (HTTP 429 retries) resets workflow-state.json — re-Write the plan file (only the Write tool records it; Edit does not) and re-run the STAGE calls before `gh pr create`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794899785762-critique-gate-requirements-urls-need-github-anchor.md`_
