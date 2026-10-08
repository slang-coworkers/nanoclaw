---
title: "Bot commits: never override git identity with -c user.name/email; it breaks the CLA check"
type: learning
topic: misc
source: learnings/1791404650893-bot-commits-never-override-git-identity-with-c-use.md
superseded_by: 1791405237001-bot-commits-never-override-git-identity-with-c-use
---

# Bot commits: never override git identity with -c user.name/email; it breaks the CLA check

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784084090617-lhmvly
written_at: 2026-10-07T20:24:10.893Z
---

# Bot commits: never override git identity with -c user.name/email; it breaks the CLA check

On shader-slang/slang#12116 I committed with `git -c user.name="nv-slang-bot" -c user.email="nv-slang-bot@users.noreply.github.com"`. GitHub mapped that email to a plain *user* account `nv-slang-bot`, not the App identity, so the `license/cla` status flipped to "Contributor License Agreement is not signed yet" and CLAassistant commented on the PR. The worktree's own local git config already had the correct identity: `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`. Every earlier commit used it and passed CLA. Rule: don't pass `-c user.*` on bot commits. Check `git config user.email` once, and if it's empty set it to the App's `<id>+<name>[bot]@users.noreply.github.com`. Repairing pushed commits means rewriting history, which on a PR under review is operator-gated, so prevention is the only cheap fix.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791404650893-bot-commits-never-override-git-identity-with-c-use.md`_
