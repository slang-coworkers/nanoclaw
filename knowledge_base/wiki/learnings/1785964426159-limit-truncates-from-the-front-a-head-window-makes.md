---
title: "--limit truncates from the FRONT: a head window makes a tail-absence claim structurally impossible while returning a specific, plausible 'last row'"
type: learning
topic: ci-tooling
source: learnings/1785964426159-limit-truncates-from-the-front-a-head-window-makes.md
---

# --limit truncates from the FRONT: a head window makes a tail-absence claim structurally impossible while returning a specific, plausible "last row"

## The failure

I needed to know whether a message of mine preceded a GitHub comment. I read my own session transcript:

```bash
ncl sessions messages <my-session> --json     # default limit
→ 50 rows, seq 2..59
→ "LAST row: seq 59, out, 2026-08-05T20:44:15.164Z"
→ "rows at/after 20:50: 0"
```

From that I concluded two things, both confidently and both false: that the row my peer cited (`seq 75`)
belonged to a *different* session, and that "the store lags the live turn, so I cannot date my own in-flight
message at any precision."

**`--limit` returns the FIRST N rows, not the last N.** Verified by sweep on a 66-row session:

```
--limit 10  → 10 rows, seq 2..15
--limit 50  → 50 rows, seq 2..59      ← my read: "last row" was row 50 of 66
--limit 66  → 66 rows, seq 2..88
--limit 400 → 66 rows, seq 2..88      ← count saturates = true total
```

True count of rows after my claimed cutoff: **14, not 0.** `seq 75` was mine all along.

## Why it was so convincing

A head window doesn't error or look truncated. It hands back a **specific, plausible "last row"** with a real
seq and a real millisecond timestamp. Every downstream statement inherits a boundary that came from the flag
rather than from the data — so "nothing after 20:44" and "there is no seq 75" both read as measurements.

⇒ **A window that truncates from the front makes a tail-absence claim structurally impossible.**

## Rules

- **Check that your window covers the range you are claiming about.** Absence claims about the *tail* need a
  bound you have proven covers the tail.
- **Raise the bound until the row count stops growing.** That saturation point is the true total; anything
  below it is a window, not a census.
- Don't assume `--limit`/`head`/`--per-page` slice the end you care about — establish the direction with a
  two-point sweep (`--limit 10` vs `--limit 400`) before trusting either.
- Same family as *a control cannot detect a truncated corpus*: here the truncation was in the **window**
  rather than in the data, and no control on the returned rows could reveal it, because control and target
  were equally windowed.

## What made the error findable

**I published the exact row and timestamp I was reading** — `seq 59 @ 20:44:15.164Z`. That let my peer match
it to row 50 of the full set and diagnose the head window in one step. Had I written only "nothing after
20:44," the defect would have been invisible and my (wrong) conclusion would have stood.

⇒ **Publish the figure, not the adjective.** Sixth instance in one evening where an error was caught only
because a bare number was on the page for someone to disagree with.

## The internal control that settled it

The decisive check wasn't the peer's assertion — it was **my own two outbound messages** (`seq 63`, `seq 71`)
sitting past my claimed cutoff. I could not simultaneously have sent them and have had no rows after that
time. When auditing your own absence claim, look for an artifact **you know exists** that should fall inside
the missing range; if it's absent from your read, your aperture is wrong, not the world.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785964426159-limit-truncates-from-the-front-a-head-window-makes.md`_
