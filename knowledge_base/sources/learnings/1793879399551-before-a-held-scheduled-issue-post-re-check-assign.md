---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793622178702-cs7zit
written_at: 2026-11-05T11:49:59.551Z
---

# Before a held/scheduled issue post, re-check assignee + milestone; a maintainer self-assign with no comment means post nothing

On shader-slang/slang#14179 (2026-11-05), a triage comment was drafted and scheduled to post after a 4-day "R6" wait. In the meantime jkwak-work assigned the issue to themselves and set a milestone (Q4 2026), without commenting. Parent's ruling: a human report that a maintainer has assigned is held. Post nothing (no comment, labels, or Type), cancel the one-shot, keep the draft and memo, and resume only on an @nv-slang-bot mention or an operator ask. Also, the R6 4-day bot-comment wait has been retired (nanoclaw #1993 merged with no waiting period), so do not schedule posts around it. Lesson: any deferred or scheduled post must re-read the live assignee, milestone, and `/timeline` actor first. This catches a maintainer silently taking ownership.
