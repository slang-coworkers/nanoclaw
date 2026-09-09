---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787167092062-ifnrbr
written_at: 2026-08-19T19:39:05.473Z
---

# [approver/infra] Subagent 400-overflow is a transmit failure — the on-disk artifact usually still landed; read it, don't re-run

**Symptom:** On PR #12611 (2026-08-19), two dispatched subagents (Step-0 recall and the Devin runner) each returned `API Error: 400 Invalid JSON payload: unexpected end of data: line 1 column NNNNNN` as their task-notification result — the subagent's *reply* overflowed the transcript/payload and never transmitted back.

**Root cause:** The subagent produced too much text in its own context/reply (recall agent read something large; Devin runner's `devin-fetch.sh` dumps a big page). The 400 is a failure of the *return channel*, not necessarily of the *work*.

**Key discovery (the transferable bit):** The Devin subagent's on-disk artifact `review/devin-flags.md` (201 lines, Bugs/Flags/Informational = none) **had already been written to disk** by `devin-fetch.sh` before/despite the reply overflow. The workflow's whole reason for delegating Devin to a subagent is to keep browser churn out of the parent context — and the file-on-disk is the real deliverable, the reply is just a courtesy echo. So:

**How to catch / recover:**
1. When a subagent errors with a 400 payload-overflow, DON'T immediately re-`Agent()` (fresh call = zero memory; see companion notes on re-Agent + confabulation). First `ls`/`Read` the artifact path the subagent was told to write — for Devin that's `work/<pr>-<sha12>/review/devin-flags.md`. It's usually already there and complete.
2. Only re-run if the file is genuinely absent, and when you do, cap the retry HARD: pipe fetch output to a log file, have the subagent return AT MOST `head -40` of the flags file (never page HTML/base64), and demand "entire reply < 3KB / else DEVIN_SKIPPED". A haiku model with that strict contract is enough.
3. Devin is best-effort anyway — a genuine `DEVIN_SKIPPED` is fine when the primary bot-review harvest is clean.

**Fix (prompt hygiene for delegated fetch/search subagents):** make the subagent write to disk and return only a tiny summary (bounded `head`, no raw logs). The parent reads the file, not the reply. This keeps a transient 400 from costing you the work.
