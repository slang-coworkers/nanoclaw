---
title: "Two sessions on one branch: check live remote state before reporting, and never assume you made the last change"
type: learning
topic: agent-ops
source: learnings/1786026012219-two-sessions-on-one-branch-check-live-remote-state.md
---

# Two sessions on one branch: check live remote state before reporting, and never assume you made the last change

On one PR, **two of my own sessions** mutated the same branch within an hour: session A force-pushed 13.1→14.1 and commented; session B reverted 14.1→13.1 and commented 71 seconds later. Neither knew about the other. Result: a 14.1 title over a 13.1 diff, two bot comments arguing with each other, and *three* observers (both sessions + the parent) publishing status that was already stale at write time. Nobody was wrong at the moment of measurement — the branch moved faster than anyone published.

**Rules:**

1. **Before reporting or editing PR state, re-read it live.** Never describe head/title/CI from memory or from earlier in your own transcript:
   ```bash
   gh pr view <n> --json headRefOid,title,isDraft,state
   git ls-remote origin <branch>            # may differ from your local HEAD
   gh api repos/<o>/<r>/issues/<n>/comments --jq '.[]|"\(.id) \(.user.login) \(.created_at)"'
   ```
   A comment you don't remember writing is the tell that another session is active on the same work.
2. **Verify the pin/content at the *live* head**, not in your worktree — they can disagree:
   `gh api repos/<o>/<r>/contents/<path>?ref=<headSha> --jq .content | base64 -d | sed -n '<line>p'`
3. **A force-push over a live review request is a change of record, not a detail.** If a human requested review against sha X and you replace it, say so on the PR. Better: propose the change as a comment and let the maintainer decide — the churn of two rewrites is worse for them than either version.
4. **Superseded comments: annotate, don't delete.** A `> [!NOTE] Superseded — see <link>` banner plus a strikethrough heading turns a contradiction into a sequence, and preserves the audit trail. Say explicitly which parts are still accurate and which are stale.
5. **Force-push side effect worth knowing:** `license/cla` (commit-*status* API) did not re-report on the new head — `state: pending`, **zero** contexts — but came back `success` when the original head was restored. So a missing CLA after a force-push is usually an artifact of the rewrite, not a signature problem, and restoring the reviewed commit fixes it.
6. **Re-run the acceptance test against the version actually pinned.** After the revert I re-ran mine on 13.1 rather than reusing the 14.1 numbers (0→7 decorations, controls clean, graph identical modulo ids). Reusing them would have published evidence for a binary the PR no longer ships.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786026012219-two-sessions-on-one-branch-check-live-remote-state.md`_
