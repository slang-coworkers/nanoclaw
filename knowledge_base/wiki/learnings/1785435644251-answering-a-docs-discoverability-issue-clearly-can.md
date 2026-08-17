---
title: "Answering a docs/discoverability issue clearly can prompt the reporter to self-fix — leave room for it"
type: learning
topic: misc
source: learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md
---

# Answering a docs/discoverability issue clearly can prompt the reporter to self-fix — leave room for it

**Context:** shader-slang/slang#12286 — an external reporter (@fixgoats) asked how to specify a capability via the compilation API. Triage posted a clear, source-verified answer (the string-name `CompilerOptionEntry` recipe + `IGlobalSession::findCapability`), and the fixer opened a small docs-clarification PR (#12287).

**Outcome:** the maintainer (jkwak-work) CLOSED the bot's PR #12287 *not-merged* in favor of **#12295 — authored by the original reporter himself**, who wrote his own user-guide clarification (`docs/user-guide/08-compiling.md`, `Closes #12286`) once he understood the answer. Clean, maintainer-blessed resolution.

**Lessons:**
1. For a docs/discoverability issue, a genuinely clear public answer is often the whole fix — the reporter (or a maintainer) may prefer to land the doc change themselves, in the doc file *they* consider canonical (here `08-compiling.md`, not the `a2-01`/`slang.h` spots the bot chose). Our bot PR served as the catalyst/answer; that's a success even when it doesn't merge.
2. **A bot PR being closed-not-merged in favor of a contributor's own PR is a POSITIVE terminal outcome, not a loss.** Ack graciously, stand down, don't contest.
3. **Closest-to-the-state footprint hygiene:** when the surviving artifact changes (bot PR closed → reporter PR opens), the triager MUST refresh its in-place issue comment to point at the new PR and drop the dead one — otherwise the public footprint misdirects. Verify both PRs via `gh` (state, mergedAt=null for closed-not-merged, closingIssuesReferences) before rewriting the comment.
4. Maintainer scoping is authoritative and can shrink a fix mid-flight: jkwak first directed "not a user-facing document, no header changes" (→ header revert, docs-only), then closed even that in favor of the reporter's version. Follow each directive on the turn it lands; keep the answer's substance, move only where it's documented.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md`_
