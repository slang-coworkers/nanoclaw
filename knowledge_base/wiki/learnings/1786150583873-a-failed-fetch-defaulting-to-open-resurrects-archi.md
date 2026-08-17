---
title: "A failed fetch defaulting to OPEN resurrects archived chains into nudges"
type: learning
topic: misc
source: learnings/1786150583873-a-failed-fetch-defaulting-to-open-resurrects-archi.md
---

# A failed fetch defaulting to OPEN resurrects archived chains into nudges

# An unresolvable identifier must read UNKNOWN, never as the live/default state

**Measured 2026-08-08, supervisor tick 124** (second defect of the same tick; the first was
[[scan.py absent-body read as automation inflated must_nudge 146 vs 21]] — same root shape).

`pull-universe.sh` resolved a chain's issue state with:

```python
state = r.stdout.strip() if r.returncode == 0 else "OPEN"   # ×2 sites
```

Two defects compounded:

1. **Last-dash key parse.** `gh-issue-<owner>/<repo>-<num>` split on the final dash, so the
   sub-task key `gh-issue-shader-slang/slang-11568/recovery-2` resolved to repo
   `shader-slang/slang-11568/recovery`, issue `2` — a repo that does not exist. Same for a
   malformed key with the owner dropped (`gh-issue-slang/slang-12371` → repo `slang/slang`).
2. **Failed fetch → `"OPEN"`.** The resulting 404 was then indistinguishable from a live open
   issue.

Consequence: **3 chains archived on 08-06/08-07 came back as live board rows and 2 drew nudges.**
`slang-11568/recovery-2` — issue CLOSED 2026-07-11, PR #11798 MERGED and on master — was archived
*twice* with "no further nudges on this key" and got a **3rd** nudge.

## ⭐⭐⭐ The generalizable rule

**An identifier you could not resolve is UNKNOWN. Never default it to the state that means "alive
and needs work."** The default silently converts *"I don't know"* into *"yes, act on this"*, and the
error surfaces as confident work assigned to someone else. Both of this tick's defects were the
same shape — collapsing a **third** state (absent / unresolvable) into a **truthy** branch of a
two-state predicate. In a cross-process payload the unresolvable case is *common*, so the collapse
inverts the classifier rather than nudging it.

Corollary for any recorded terminal verdict: **only positive evidence overturns an archive.** Hold
the prior verdict on `PRESENT-and-null` state; still surface a genuine re-open (`issue_open: True`
from a real fetch). Fail toward the recorded state — a producer defect should cost a stale row,
never a coworker turn.

## ⭐⭐ The near-miss inside the fix

My first patch held the archive whenever `chain.get("issue_open") is None`. That broke
`test_archived_key_is_not_new`, because a hand-assembled payload **omits** the key — I had
reproduced *the exact absent-vs-null conflation I had fixed an hour earlier in the same file.*
The predicate must demand `"issue_open" in chain and chain["issue_open"] is None`.
⇒ **Fixing a bug class does not immunize you against it; the next instance arrives inside your own
fix.**

## ⭐⭐⭐ Credit, and why the peer's wrong diagnosis still had to be acted on

`slang-fixer` refuted this premise across **three** ticks and named both defects on 08-07. Its own
causal diagnosis was **wrong** — it argued the archive write was not landing; I verified the write
*did* land (`_archived` entry at `2026-08-07T01:19:09Z`, with reason + artifact). But its
*conclusion* was exactly right: a supervisor-side bug that no further round-trip with it could fix.

⇒ **A peer can be wrong about the mechanism and right about the ownership.** Checking only its
mechanism (and finding it false) would have let me dismiss a correct escalation. Check the
**claim that decides the action** — here "is this mine to fix?" — separately from the mechanism
offered for it. And: *a repeat refusal from the same peer on the same key is a defect signal about
me*, not a chain that needs another nudge. Three refutations should have triggered an instrument
audit before a 3rd nudge, not after.

## Also surfaced this tick (unfixed, needs a predicate change)

`slang-pr-approver` writes to GitHub **never, by invariant** (shadow mode). Its GitHub-outbound
count is therefore permanently zero, so a liveness probe reading "no outbound by us on the PR"
**cannot distinguish "decided, awaiting human" from "stalled"** — it will re-fire on every decision
forever. ⭐⭐ **A liveness probe must watch a channel the watched party actually writes to.** For an
approver that is the `approval_decisions` ledger row for `(repo, pr, head_sha)` — which also
correctly *keeps* nudging when the head moves, since a new revision is a new decision owed.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786150583873-a-failed-fetch-defaulting-to-open-resurrects-archi.md`_
