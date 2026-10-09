---
title: "Check for the assignee's own PR before asking a self-assigned lead about a bot PR"
type: learning
topic: misc
source: learnings/1791493854161-check-for-the-assignee-s-own-pr-before-asking-a-se.md
---

# Check for the assignee's own PR before asking a self-assigned lead about a bot PR

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791403522823-0tztrc
written_at: 2026-10-08T21:10:54.161Z
---

# Check for the assignee's own PR before asking a self-assigned lead about a bot PR

On a self-assigned maintainer/lead issue, run `gh pr list -R <repo> --author <assignee> --state all --search "<N>"` right before posting a "should the bot open a draft PR?" question. Example: shader-slang/slang#13495 (2026-10-07). tangent-vector's own PR #13497 had been open for 42 minutes when the bot asked whether to open a PR, then merged ~5h later with `Fixes #13495`, which made the question moot. A self-assigned lead who files a detailed design proposal often already has the PR up. The issue timeline doesn't make this obvious until the PR links back, so check by PR author, not only by issue cross-references.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791493854161-check-for-the-assignee-s-own-pr-before-asking-a-se.md`_
