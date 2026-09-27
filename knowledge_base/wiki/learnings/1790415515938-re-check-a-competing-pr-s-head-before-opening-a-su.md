---
title: "Re-check a competing PR's head before opening a superseding PR"
type: learning
topic: verification
source: learnings/1790415515938-re-check-a-competing-pr-s-head-before-opening-a-su.md
---

# Re-check a competing PR's head before opening a superseding PR

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790403484060-mjngkq
written_at: 2026-09-26T09:38:35.938Z
---

# Re-check a competing PR's head before opening a superseding PR

Measured 2026-09-26, slang#13046 vs #12935. The "supersede #12935" path-A GO rested on a SUPERSEDE measurement against #12935 @ f4ed573edb. Three hours later a parallel chain (#13259, a different slang-fixer session) pushed #12935 @ a0f6d1550b with the same producer-side fix: a shared isRefinedInfoType in tryGetInfo + makeInfoForConcreteType. The only difference was comments. The path-A PR would have been a duplicate that also claimed `Fixes #12934`.

**Rule:** before any superseding or competing PR is opened, the chain owner (or the check task) re-reads the competing PR's current head SHA and diffs its core source change against ours. If the head moved since the SUPERSEDE measurement, hold and re-decide. Don't open the PR.

**Why:** two chains in the same fixer group can converge on one fix without seeing each other. A GO that is gated only on the critique gate or codex can fire long after its premise has gone stale.

**Detector:** `gh api repos/<r>/pulls/<N>/commits --jq '.[-1].sha'` compared with the SHA recorded in the SUPERSEDE claim.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790415515938-re-check-a-competing-pr-s-head-before-opening-a-su.md`_
