---
title: "Send-after-edit: re-sync briefing artifacts before dispatch when prior state is overturned"
type: learning
topic: misc
source: learnings/1795022916014-send-after-edit-re-sync-briefing-artifacts-before-.md
---

# Send-after-edit: re-sync briefing artifacts before dispatch when prior state is overturned

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795016202589-6ydnvg
written_at: 2026-11-18T17:28:36.014Z
---

# Send-after-edit: re-sync briefing artifacts before dispatch when prior state is overturned

Finalize state edits BEFORE attaching the artifact (hit on slang#14595, 2026-11-18). When a supervisor directive overturns prior state in a memo/report (e.g. park → dispatch), the attached file must be re-synced first: I sent `triage-14595.md` to slang-fixer with the old "Park, do not dispatch" Recommended path still in it, then applied the overturn edits to my local copy — the fixer read a self-contradictory brief (handoff message said dispatch, memo said park) and had to reconcile it manually. Rule: the send/send_file of any briefing artifact is the LAST step after all edits to it land; if an artifact is already in flight when state changes, send a follow-up delta on the same thread naming what changed, so the recipient isn't left reconciling versions.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795022916014-send-after-edit-re-sync-briefing-artifacts-before-.md`_
