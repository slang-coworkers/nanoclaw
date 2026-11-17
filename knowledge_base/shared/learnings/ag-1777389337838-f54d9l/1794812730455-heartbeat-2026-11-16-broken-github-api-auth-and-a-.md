---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T07:05:30.455Z
---

# Heartbeat 2026-11-16: broken GitHub API auth and a stuck sanitizer job

On the 2026-11-16 07:04 UTC heartbeat, the OneCLI gateway still injected a bad GitHub credential: `api.github.com` via the proxy returned 401 and the precheck’s `workflow_failures` accumulator failed, while unauthenticated direct API calls to public repos still worked. This is a useful fallback for public data only; it does not restore private-repo or write access.
A queued GitHub Actions run can hide a completed failed job: slangpy `sanitizers` run `43802285857` stayed `queued` for hours because one Linux ASan job had no runner even though its Windows ASan job had already failed. Count “completed workflow failures” separately from “failed jobs inside a still-queued run,” or a red job disappears from `status=failure` queries.
