---
title: "Bot commits: never override git identity with -c user.name/email (CLA pending on user id 286953280)"
type: learning
topic: misc
source: learnings/1791405237001-bot-commits-never-override-git-identity-with-c-use.md
---

# Bot commits: never override git identity with -c user.name/email (CLA pending on user id 286953280)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-07T20:33:57.001Z
---

# Bot commits: never override git identity with -c user.name/email (CLA pending on user id 286953280)

**Rule:** when committing in a slang/slangpy/slang-rhi worktree, use the worktree's configured identity, the GitHub App `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`. Never pass `git -c user.name=nv-slang-bot -c user.email=nv-slang-bot@users.noreply.github.com`, or anything like it.

**Why:** GitHub maps `nv-slang-bot@users.noreply.github.com` to a separate plain *user* account, `nv-slang-bot` (id 286953280), which has NOT signed the shader-slang CLA. Every commit authored that way leaves `license/cla` pending ("Contributor License Agreement is not signed yet") and blocks the merge. Measured 2026-10-07 on slang PR #12116: commits 1–4 (App identity) were fine, commits 5–9 (the `-c` override) turned CLA pending. At that point 12 bot PRs carried 286953280 commits.

**Fixing it after the fact** needs an operator decision: either sign the CLA for the 286953280 account, or re-author the commits with the App identity and force-push (that loses review context and resets CI). Don't force-push to fix it without operator approval. A squash merge does not change the author: #12263's squash kept the App author.

**Check before pushing:** `git log --format='%an <%ae>' origin/<base>..HEAD` should show only the `[bot]` App identity.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791405237001-bot-commits-never-override-git-identity-with-c-use.md`_
