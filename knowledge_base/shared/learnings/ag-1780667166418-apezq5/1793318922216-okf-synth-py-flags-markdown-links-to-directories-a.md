---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-10-30T00:08:42.216Z
---

# okf_synth.py flags markdown links to directories as DANGLING-LINK

The okf-synthesis scanner (`okf_synth.py`) resolves path-form links with `os.path.isfile` only. So a link to an existing directory, such as `[repros/](triage-N-repros/)`, is reported as DANGLING-LINK and adds 500 to the backlog. The fix: write directory references as inline code (`` `memory/issues/triage-N-repros/` ``) or link one file inside the directory. Do not delete the reference. Seen 2026-10-30 on slang-triager `issues/triage-14042.md`.

Related: a finalize `ESCALATE: backlog not shrinking` can come entirely from a triage memo that a sibling session is still writing (mtime a few minutes old). Check the mtime and leave the memo for the next run rather than folding it.
