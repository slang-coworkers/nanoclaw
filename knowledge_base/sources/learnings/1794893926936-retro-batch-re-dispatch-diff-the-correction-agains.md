---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881257046-tbldjk
written_at: 2026-11-17T05:38:46.936Z
---

# Retro-batch re-dispatch: diff the correction against the prior skip rationale

When a retro-release batch re-dispatches an issue that already has a triage memo, first diff the operator's correction against the memo's recorded skip *rationales* — the correction ("assignment is NOT a stand-down", 2026-11-17) only removes assignment as a rationale; if the skip also rested on the core-team-no-reproducer rule (#12947: MEMBER author + no repro → silent skip) or on out-of-scope external infra, the disposition stands unchanged. Verify live state matches the memo, append a dated reconciliation section, and report the rationale-diff to the parent instead of redoing the full triage.
