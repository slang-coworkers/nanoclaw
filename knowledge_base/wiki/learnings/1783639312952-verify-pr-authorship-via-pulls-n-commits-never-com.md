---
title: "Verify PR authorship via pulls/<n>/commits, never commits?sha=branch (post-merge false positive)"
type: learning
topic: verification
source: learnings/1783639312952-verify-pr-authorship-via-pulls-n-commits-never-com.md
---

# Verify PR authorship via pulls/<n>/commits, never commits?sha=branch (post-merge false positive)

**Rule:** To determine who authored a PR's commits — especially "did our bot push to this branch?" — query the **PR-scoped** endpoint `gh api repos/<o>/<r>/pulls/<n>/commits`, NOT `gh api repos/<o>/<r>/commits?sha=<branch>` (nor `git log <branch>`).

**Why:** `commits?sha=<branch>` / `git log <branch>` return the branch's full **ancestry**. Once a maintainer merges master into a PR branch (routine on long-lived PRs to resolve conflicts / catch up), that ancestry includes **all of master's recent commits from unrelated PRs** — including your bot's commits from *other* merged work. Counting `nv-slang-bot` commits there produces a **false positive**: "the bot pushed N commits to this PR" when the bot never touched this branch — those N are unrelated master commits pulled in by the merge. `pulls/<n>/commits` returns ONLY the PR's own commits, so it's authoritative for "who worked THIS PR."

**Incident (shader-slang/slang#10788, 2026-07-09):** investigating whether a slang-fixer had engaged a maintainer-work-ordered PR. `commits?sha=copilot/fix-empty-structs-handling` showed "9 nv-slang-bot commits" → I concluded the bot engaged and relayed that to the operator. WRONG. `pulls/10788/commits` showed **5 commits, 0 from nv-slang-bot**: 3 from the original Copilot draft author, 1 maintainer master-merge, 1 maintainer's own fix. The "9 bot commits" were master's unrelated bot commits dragged in by the 17:36 master-merge. The bot never pushed to #10788; the branch head moved purely via maintainer activity. This is the mirror image of an earlier false-NEGATIVE on the same chain (stale "no activity" read).

**Corollary:** the same care applies to reading a branch HEAD to judge "did the fixer push?" — a moved head can be a maintainer's master-merge or their own commit, not your bot's. Always confirm the AUTHOR of the specific commits via the PR-scoped endpoint before asserting "the bot worked / didn't work this PR" upstream. Ties to the general discipline: verify claims at claim-precision against the authoritative source, and — since this is authorship, which drives stand-down-vs-re-drive decisions — getting it wrong inverts the correct action (re-drive a "stalled" chain that maintainers actually own = clobber risk).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783639312952-verify-pr-authorship-via-pulls-n-commits-never-com.md`_
