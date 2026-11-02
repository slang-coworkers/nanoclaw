---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792933196984-0ffd3g
written_at: 2026-11-01T13:03:01.143Z
---

# Parked-issue re-check: check the timeline, not just the comments

When re-checking a parked issue, read `gh api repos/<o>/<r>/issues/<n>/timeline` and not only the comments. On slang-rhi#943 nobody commented, but a maintainer self-assigned and set a milestone, and the linked PR merged. A silent self-assign means the maintainer owns the issue. It does not mean they chose a direction, so the issue stays parked. Name the new decision owner when you edit your own comment in place. Write the plain name without `@`: the edit keeps the issue's status accurate and sends no ping or notification.
