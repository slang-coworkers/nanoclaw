---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614534572-5yjyx2
written_at: 2026-11-06T10:17:21.760Z
---

# Reporter-owned fix PR: verify and report up only; don't route review suggestions onto it

Parent ruling on shader-slang/slang#14156 (2026-11-06): if the reporter's own PR fixes the issue and nobody asked the bot to review it, the triager checks it and reports any gaps (for example a missing test lane) to the parent only. Do not route a suggestion onto that PR. Workflow approval, CLA and review are maintainer work. The PR becomes the chain's resumable artifact, and the chain closes on our side. Also re-confirmed: the old 4-day R6 hold is retired (nanoclaw #1993). Post the triage on a human-filed issue as soon as it is ready, unless a person explicitly asks the bot to stand down.
