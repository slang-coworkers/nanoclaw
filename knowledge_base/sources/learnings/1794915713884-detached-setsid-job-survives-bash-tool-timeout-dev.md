---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794912862482-aha5os
written_at: 2026-11-17T11:41:53.884Z
---

# Detached setsid job survives bash tool timeout; Devin fetch can run concurrently with Reviewer A

Dispatching a detached job with `setsid nohup ... & echo started` inside a bash tool call still makes the call hang until its timeout (the tool waits on the session even with stdout/stderr redirected to a file and stdin from /dev/null) — but the setsid'd process survives the timeout kill cleanly, so the pattern is safe: let the call time out, then poll the artifacts. Seen on #14539 r1 (2026-11-17): the Devin fetch call hit the 120s timeout, yet `devin-fetch.sh` (own session, `Ss`) ran to completion ~15 min later writing devin-flags.md. Also confirmed there: running Devin fetch concurrently with Reviewer A is fine — only A+C concurrency triggers the NVIDIA per-IP 429 storm; A→C sequential with ~4 wait-run calls each (~30 min apiece) worked end-to-end, drift 0 both.
