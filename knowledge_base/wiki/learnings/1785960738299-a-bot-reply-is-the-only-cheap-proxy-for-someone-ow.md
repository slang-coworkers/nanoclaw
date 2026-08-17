---
title: "A bot reply is the only cheap proxy for 'someone owns this fan-out item' — but check sessions before routing"
type: learning
topic: agent-ops
source: learnings/1785960738299-a-bot-reply-is-the-only-cheap-proxy-for-someone-ow.md
---

# A bot reply is the only cheap proxy for "someone owns this fan-out item" — but check sessions before routing

# Fan-out scrub sweeps: verify the SET, but check sessions before concluding "dropped"

**Context.** 2026-08-05: `jkiviluoto-nv` posted an identical "Mukund won't be returning — scrub this issue" request on **22 shader-slang/slang issues in 25 seconds** (18:40:15–18:40:40Z). I received **exactly 1 webhook** (#6519). Enumerating from source found the other 21.

## The reusable enumeration

```bash
gh api -X GET search/issues --field q='repo:<owner>/<repo> commenter:<login> updated:>=<date>' \
  --field per_page=100 --jq '.items[].number'
```
Then per issue: does a scrub request exist, and is there a bot comment *created after* it?

**Always pair with a control** — same query at a future date must return 0. A zero from a
mis-parsed instrument is byte-identical to a real one.

## The correction worth keeping

My prior lesson said: fan-out delivery is per-issue ⇒ silence means a dropped item, route it.
**That over-fires.** Here, 10 of 22 had no bot reply — and *all 10 had active running sessions*
on their canonical `gh-issue-<owner>/<repo>-<N>` threads. Nothing was dropped; they were
mid-flight. Slang scrubs involve a clone + probe builds, so a 20+ min gap between delivery and
first comment is *normal*, not a fault.

⇒ **Two-stage test, in this order:**
1. **No bot reply?** → not yet evidence of anything.
2. **No session either?** → *now* it's an orphan worth routing.

Routing on stage 1 alone dispatches a duplicate into a sibling's live chain — the exact
double-work the per-issue thread rule exists to prevent.

## Session-check instrument traps (both produce FALSE ZEROS)

`ncl sessions list` **column-shifts** when `messaging_group_id` is empty, so `awk '$4==t'`
returns 0 for every row. And bare `grep -c <N>` matches *session IDs* containing those digits.
Use an anchored regex on the thread string, with a must-hit control:

```bash
grep -cE "gh-issue-shader-slang/slang-6519([^0-9]|$)" sess.txt   # control → non-zero
grep -cE "gh-issue-shader-slang/slang-999999([^0-9]|$)" sess.txt # control → 0
```

## Ordering is a delivery hint, not proof

#6524's request landed at 18:40:33, #6519's at 18:40:35 — 2 s apart, same wording. Spotting one
sibling in an unrelated dedup search is what revealed the fan-out at all. **When a scrub/sweep
request arrives, ask whether it was aimed at a set**; a lone webhook does not mean a lone target.

See also: verifying a peer's finding before relaying it — the #6519 triager's coverage-absence
claim reproduced repo-wide via GitHub code search (a different instrument than their `git grep`),
and was in fact *broader* than the `tests/reflection/` scope they published.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960738299-a-bot-reply-is-the-only-cheap-proxy-for-someone-ow.md`_
