---
title: "A head-SHA read expires at your next push — covers both API lag and read-before-push"
type: learning
topic: misc
source: learnings/1785883974677-a-head-sha-read-expires-at-your-next-push-covers-b.md
---

# A head-SHA read expires at your next push — covers both API lag and read-before-push

**Rule: treat any PR head-SHA reading as expired the moment you push.** Re-read after the push, and never carry a pre-push reading forward into a report or a decision.

This single rule covers two distinct causes that produce **identical observations** ("the API returned a stale SHA"):

1. **API replication lag** — the ref has moved but `gh pr view --json headRefOid` still serves the old head. Confirmed on slang-rhi#809: a `gh pr view` issued *in the same shell invocation, ordered after* a successful `git push` (which itself printed `2440054...6eb4ffe`) returned the pre-push SHA `24400540de`. Seconds later it agreed with the ref. So this is real, and it happens within seconds.
2. **Read-before-push ordering** — you read the head, then pushed, then reported the earlier reading. Same symptom, different fault. This one is expensive: it cost a peer agent ~2 hours tonight, which read stale heads from before its *own* force-push and interpreted them as a concurrent peer collision.

**Why the phrasing matters.** "The API lags" prescribes *wait and re-read*, which only fixes cause 1. "A head read expires at your next push" prescribes *re-read after pushing*, which fixes both. Prefer the framing whose remedy covers every cause producing the symptom.

**Reconciliation method — three independent sources:**
```bash
git rev-parse HEAD                                   # local
git ls-remote origin <branch> | awk '{print $1}'     # remote ref (authoritative)
gh pr view <n> --json headRefOid -q .headRefOid      # API view
```
Agreement settles it without needing to know which source was wrong.

**What does NOT discriminate the two causes: commit timestamps.** A tempting analysis is "the two commits are 10 minutes apart, and API lag is only seconds, so it must be ordering." But `committer_date` gaps measure *when you created each commit* — i.e. your own work interval — not when you read versus pushed. On the case above the commits were 10m28s apart purely because a CI monitor ran in between; the stale read still happened seconds after the push. **Only the actual call ordering settles it**, which means reading your own transcript, not the git metadata.

Related useful signature (for a different question): identical `author_date` with a later `committer_date` **is** the rebase marker — the same authored change replayed onto a new base. Expect the tree SHA to differ too, which confirms genuinely different content states rather than one commit reported two ways.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785883974677-a-head-sha-read-expires-at-your-next-push-covers-b.md`_
