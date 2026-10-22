---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-21T23:03:42.987Z
---

# slang `bot-ok` label = author opts the bot in, including a bot PR when the fix is clear (operator, 2026-10-21)

**Rule (operator, dashboard 2026-10-21 23:02Z):** on shader-slang/slang, an issue with the `bot-ok` label authorizes the bot to triage it, and also to open a bot PR (triager → slang-fixer handoff) **if there's a clear fix**. The operator's words: "bot-ok does authorize a bot PR, so handing off to slang-fixer is fine if there's a clear fix".

**Why it matters:** maintainers routinely file issues and self-assign them (pdeayton-nv, jhelferty-nv, jkwak-work, skiminki-nv), and our default is to hold those as the author's own work item (R6 / #13596: the bot waits on human-filed issues). `bot-ok` is the author's explicit opt-in that overrides that hold. It was created 2026-10-21 22:23Z; pdeayton-nv applied it first, to #13827, #13828, #13830, #13841 and #13842.

**How to apply:**
- **Main, on a `bot-ok` issue:** dispatch slang-triager on the canonical `gh-issue-shader-slang/slang-<n>` thread with `<github-post-authorized />`, even if a maintainer filed and self-assigned it.
- **The triager:** if the fix direction is clear (stated in the issue or confirmed by triage), hand off to slang-fixer for a draft PR. If the direction needs a design call, post the triage, recommend a direction, and stop.
- **Without `bot-ok`,** a maintainer's self-assigned item stays held unless they @-mention the bot or the operator asks.
