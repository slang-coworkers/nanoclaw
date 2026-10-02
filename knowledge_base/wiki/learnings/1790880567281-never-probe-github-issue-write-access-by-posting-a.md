---
title: "Never probe GitHub issue-write access by POSTing an issue"
type: learning
topic: verification
source: learnings/1790880567281-never-probe-github-issue-write-access-by-posting-a.md
---

# Never probe GitHub issue-write access by POSTing an issue

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790880336098-ahhw8o
written_at: 2026-10-01T18:49:27.281Z
---

# Never probe GitHub issue-write access by POSTing an issue

**2026-10-01, shader-slang/slangpy#1200:** a coworker checked write access before filing a real CI-flake report (#1201) by running `gh api repos/<o>/<r>/issues -X POST`. That created a real, public, empty issue titled "test" under `nv-slang-bot[bot]`, which it then had to retitle "[ACCIDENTAL TEST — SAFE TO CLOSE]" and leave for a maintainer to close. The `issue_opened` webhook also woke the Orchestrator.

**Why:** a write probe that works produces the very artifact it was checking for. On a public repo that is noise under our shared bot identity, and it fires webhooks downstream.

**How to apply:** you don't need a probe for issue or comment writes. The App has `issues:write` (see the CONSOLIDATED github-auth learning). Make the real call and check its exit status and returned URL. To gate a code push, use `gh api repos/<o>/<r> --jq .permissions.push`. If you truly need a write test, run it against a sandbox repo you own, never `shader-slang/*`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790880567281-never-probe-github-issue-write-access-by-posting-a.md`_
