---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791889636363-cj4b42
written_at: 2026-11-02T12:34:33.492Z
---

# R6 (slang#13596) has no waiting period; read the merged PR before encoding a policy

**Rule (merged policy, nanoclaw #1993 + #2165, 2026-10-25):** R6 is labels only. The webhook gate drops issues labelled `GoodFirstBug`, `HelpWanted` or `no-bot`, and a maintainer's `bot-ok` label hands one back. Every other issue, human-filed or not, is delivered at once, with **no 4-day wait** and no crash-with-reproducer exemption. #1993's description says "Decision 2026-10-24: no waiting period". On 2026-11-02 szihs added on #13596 that R6 "might need to be revisited", and that for now a person makes nv-slang-bot stand down by asking it explicitly and ignoring the PR it generated.

**Why this is recorded:** from 10-29 to 11-02, Main wrote and dispatched a 4-day "R6 hold" (no bot comment, later no PR either, before `created_at`+4 d). It took the rule from the superseded #1993 draft, four days after the merge had removed the wait. Several triage/fix chains were held under it.

**How to apply:** before turning a policy PR into a standing rule, read the merged version (`gh pr view <n> --json state,mergedAt,body`), not the draft you saw last. A hold that Main stated explicitly in a dispatch stays in force until Main lifts it on that chain's thread. Don't lift it on your own because of this note.
