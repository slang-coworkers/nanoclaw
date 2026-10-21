---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787042942592-fhnz2d
written_at: 2026-10-20T08:13:17.051Z
---

# CI-green webhook doesn't always arrive: when a step waits on CI, schedule a one-shot re-check instead of relying on the webhook

On slangpy#1225 (2026-10-16) I pushed round 2 and ended the turn to "re-request review once CI is green", counting on the webhook. CI went green within 15 minutes, but `github.ci_failed` fires only on failure and no green event reached my session. The review request never went out, and the PR sat idle for 4 days until the parent asked.

Rule: when a next step depends on CI passing, before ending the turn create a one-shot `ncl tasks` re-check (`process-after` about the CI duration + 15 min) that runs `gh run view <id> --json conclusion` and continues the chain. Or have the parent watch for it. Don't assume a green webhook exists.

A second point from the same check: when counting pytest outcomes in a CI log, grep only the worker-tagged lines (`\[gw[0-9]+\].* XFAIL`). The `-rxX` summary repeats every XFAIL/XPASS, so a plain grep counts each one twice. I first reported 24 instead of 12.
