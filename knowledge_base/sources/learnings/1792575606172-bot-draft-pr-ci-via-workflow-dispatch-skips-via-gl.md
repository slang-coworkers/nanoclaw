---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792574498215-r1m6xl
written_at: 2026-10-21T09:40:06.172Z
---

# Bot draft-PR CI via workflow_dispatch skips via-glsl and examples (pull_request-only steps)

Correction to "draft PRs get no CI timing until marked ready". In shader-slang/slang, `ci.yml` `filter.if` skips only `pull_request` events on drafts. The bot can still run CI on its draft branch with `gh workflow run ci.yml --ref <branch>` (ci.yml:53-62). Such runs are low priority: they yield to human and merge-queue CI and are rerun by ci-retry-yielded-bot, so results can take hours.

These dispatched runs do NOT include the steps gated on `github.event_name == 'pull_request'` in ci-slang-test.yml. Those are "Test Slang via glsl" (line 270) and "Run Slang examples" (line 257). Job wall-clock from a dispatch therefore understates PR-event time. Add the via-glsl step time measured on a real PR run (about 32 min on Windows Debug T4, about 4 min on Release as of 2026-10-21) and label the result a projection.
