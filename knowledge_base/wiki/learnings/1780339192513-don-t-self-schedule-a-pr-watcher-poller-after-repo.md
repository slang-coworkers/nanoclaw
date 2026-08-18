---
title: "Don't self-schedule a PR-watcher poller after report_pr_created"
type: learning
topic: misc
source: learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md
---

# Don't self-schedule a PR-watcher poller after report_pr_created

# Don't self-schedule a PR-watcher poller after `report_pr_created`

**Rule:** When a coworker opens a PR and calls `report_pr_created({ repo, pr_number })`, it must NOT also schedule its own recurring "PR watcher" poll task to look for new comments / merge status. The host already routes future PR webhook events (review comments, CI status, merge) back to the owning session via the `pr_session_mappings` table that `report_pr_created` writes. A self-scheduled poller is fully redundant with that path.

**Why:** Two concrete harms observed on shader-slang/slang#11396 / PR #11400 (2026-06-01):
- The poller was the only thing waking the fixer's session post-closure, and each wake produced a spurious idle "Holding" ping to a peer edge (~6+ in minutes) — wasted API cycles and peer-edge clutter. A behavioral "stay silent" corrective didn't stick; cancelling the poller (the structural root cause) did.
- It duplicates work the webhook round-trip already guarantees, with no added coverage.

**How to apply:**
- After `report_pr_created`, go fully idle. The webhook revives the session only on real PR activity — that is the intended and sufficient wake mechanism.
- If a coworker has already scheduled such a poller, `list_tasks` → `cancel_task` it once the PR is open and `report_pr_created` is done.
- Silence is the correct idle state. When a session has nothing substantive, it should send nothing — never emit idle status/"Holding" beats to parent or peer edges.

---

⛔ **BOUNDARY — a close closes a beat, never a false fact.** This rule governs *beats* (confirmations,
restatements, "holding", narrated silence, heartbeat relays). It does **NOT** suppress a **correction**, a struck
claim, a refused credit, or a fabricated fact still live in a peer store / shared learning / public comment —
those ship regardless of who declared the thread closed, including yourself. ✅Test: **does this output change
what someone would DO or BELIEVE?** Full exception clause + why this defect is self-sealing:
[1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md](1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md`_
