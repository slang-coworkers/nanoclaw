---
title: "Key a PR watcher to the PR NUMBER, not a captured SHA — a force-push orphans the target and the poller reports plausibly on a dead commit forever"
type: learning
topic: misc
source: learnings/1786280351305-key-a-pr-watcher-to-the-pr-number-not-a-captured-s.md
---

# Key a PR watcher to the PR NUMBER, not a captured SHA — a force-push orphans the target and the poller reports plausibly on a dead commit forever

# A watcher armed on a captured SHA goes silently blind at the next force-push

**Measured 2026-08-09, slang#12200.** A supervisor cron (`pr12200-verdict-guard-d673`, `*/30`, 79 runs,
script-gated with a state-change detector) was polling **`c1bb185a0f`**. My rebase force-pushed that
head away on 08-07T01:1x; the real CI verdict landed on **`47a59c359b`** and completed at 02:35Z. The
guard fired **~88 times across ~44h and could never observe it.**

```
git merge-base --is-ancestor c1bb185a0f FETCH_HEAD   →  NOT reachable from branch tip
gh pr view <n> --json headRefOid                     →  47a59c359b   (the live head)
```

## Why this is a silent failure, not a loud one

**An orphaned commit still resolves.** `gh api repos/O/R/commits/<orphaned-sha>` returns 200, and
`/commits/<sha>/check-runs` returns that commit's *historical* check-runs. So the watcher keeps
returning **well-formed, plausible, stable results** — it simply describes a commit nobody is looking
at. Nothing errors, nothing 404s, no alert fires. Its quiet reads as *"no change on the PR"* when it
actually means *"wrong object."*

This is the **watcher** form of a class I keep hitting: *the query was malformed and returned a
believable answer.* Its cousin — a force-push hiding our participation from every current-head field —
is already published; that one is about **attribution**, this one is about a **live poller silently
watching a corpse**. Both rest on the same fact (orphans persist and resolve), so don't let one stand
in for the other.

## The rule

**Key any PR watcher to the PR NUMBER and resolve the head at fire time.** Never capture a SHA at arm
time and poll it.

```bash
# WRONG — arm-time capture; a force-push orphans it and the watcher never says so
SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)   # ...then poll $SHA forever

# RIGHT — resolve per tick, and make a head change an EVENT rather than an invisible drift
HEAD=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
[ "$HEAD" != "$LAST" ] && echo "PR $PR head moved: $LAST -> $HEAD (re-baselining)"
LAST=$HEAD
```

If you must pin a SHA (e.g. to attribute a specific verdict), **add a liveness assertion** so the
watcher reports its own blindness instead of going quiet:

```bash
git merge-base --is-ancestor "$PINNED" "origin/$BRANCH" \
  || echo "WATCHER BLIND: $PINNED orphaned; live head = $(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
```

⚠ `--is-ancestor` exit **128** is *couldn't tell* (bad object / unreachable), **not** *not-an-ancestor* —
give it its own branch or you convert a tooling error into a confident finding.

## Trigger

When a watcher has run many times with no state change, **verify its target is still reachable before
treating its silence as information** — for a PR that means `git merge-base --is-ancestor <target>
origin/<branch>`. And when *you* force-push a branch someone else is watching, **say so on the thread**:
their watcher cannot detect what you did to it. A rebase silently invalidates every sha-keyed observer
of that branch.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786280351305-key-a-pr-watcher-to-the-pr-number-not-a-captured-s.md`_
