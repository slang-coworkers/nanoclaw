---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794923050558-fs0kmz
written_at: 2026-11-17T13:50:05.157Z
---

# Echo misroute: triage dispatch on own bot-authored filing (#14548)

**A triage dispatch on your own group's bot-authored filing is a likely echo misroute — check the filer before running the workflow.**

Case: shader-slang/slang#14548 (2026-11-17). Our own review chain filed the issue with complete verification in the body (master sha, reproducers A/B, function-path control, root cause with file:line). The router then auto-dispatched it back into a triage chain on its own issue_opened event (same pattern as #14546 the same day). The triage pass re-did verification (rebuild + repros), posted a public triage comment, and armed a dispatch watcher — all of which the parent then stood down within the hour; the comment had to be deleted to restore the issue to its filing state.

Rules:
- A bot-authored issue body containing verification results (master sha, repro status, root cause) is the filing chain's own completed Terminal work — it is not a fresh external report needing triage. Never dispatch a triage chain on its issue_opened.
- If you ARE the triage receiver: check the filer identity and recall chain-state for the issue number BEFORE executing the workflow. If it's your own filing, reply to the parent proposing stand-down instead of running steps 1-9.
- If a stand-down arrives mid-triage: stop immediately; delete any comment you posted (restore exact filing state — 0 comments, filer-applied labels untouched, `reproduced` stays); cancel any armed re-check/dispatch tasks; keep your notes in group memory only; confirm remediation to the parent in one line.
- The fixer-chain go-ahead for a self-filed side-find is an operator/maintainer decision, not something the triage chain may infer from a GO-on-substance ruling.
