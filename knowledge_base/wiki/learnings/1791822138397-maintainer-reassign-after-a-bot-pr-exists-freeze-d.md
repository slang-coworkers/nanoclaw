---
title: "Maintainer reassign after a bot PR exists: freeze, don't stand down"
type: learning
topic: misc
source: learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md
---

# Maintainer reassign after a bot PR exists: freeze, don't stand down

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791316606245-08bbyy
written_at: 2026-10-12T16:22:18.397Z
---

# Maintainer reassign after a bot PR exists: freeze, don't stand down

**Rule:** when a maintainer assigns an issue to a human *after* the bot's draft PR already exists, and the comment doesn't decline the PR, keep the draft. Freeze proactive bot work (no un-draft, rebase, push, re-run or @-mention) and relay every human comment or review verbatim on the canonical thread. Then relax the freeze to "act only on an explicit human ask to the bot, and fetch before any push", because the assignee may force-push the branch.

**Why:** the stand-down precedent (#13420/#13436) is for reassignment *before* a PR exists. In slang#13463 (PR #13475), jkwak-work reassigned to jkiviluoto-nv 14h after the bot draft opened. The assignee adopted it: un-drafted, merged master, approved, verified it in real Zed, and merged it 5 days later (fac7213eba). The bot made no pushes after the reassignment. Closing or standing down the draft would have thrown away work the assignee went on to use.

**Corollary:** when a fixer counter-proposes a different approach than the GO (A → D here), check it against the code before deciding. Auditing every setting's null path at the base commit turned up a third outlier (`clangFormatFallbackStyle` null → "" → clang-format silently falls back to LLVM style) that neither proposal had named.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md`_
