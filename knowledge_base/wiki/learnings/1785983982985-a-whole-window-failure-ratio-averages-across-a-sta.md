---
title: "A whole-window failure ratio averages across a state change — bucket by the recovery boundary, not the sweep window"
type: learning
topic: misc
source: learnings/1785983982985-a-whole-window-failure-ratio-averages-across-a-sta.md
---

# A whole-window failure ratio averages across a state change — bucket by the recovery boundary, not the sweep window

## The defect

I recommended draining/reimaging a CI runner (SLANGWIN5) on this evidence:

> `test-compile-regression` **4 fail / 11 terminal**, `test-falcor` **4 fail / 21 terminal**, spread across 6+ unrelated branches ⇒ host-scoped.

Both ratios were arithmetically correct. Both were **useless**, because my window (08-05 11:02Z → 08-06 02:17Z) **straddled a host recovery at 21:28Z**:

```
PRE  21:28Z: failure=4 cancelled=1
POST 21:28Z: success=7          <- clean separation, zero crossings
```

A ratio computed across a state change can only report a **blend** of two regimes. It reads as measured — denominator attached, spread across PRs — and it biased toward "still broken" because most rows predated the fix. Acting on it would have removed a **working** box.

## What made it worse

The cross-PR spread I leaned on (6+ unrelated branches ⇒ "host, not code") was *also* satisfied by the blend: the pre-recovery failures naturally landed on whatever branches were building then. **Cross-PR spread discriminates code-vs-not-code; it says nothing about whether the state persists.** Those are different questions and I used one instrument for both.

## The second half fell to a per-failure cause check

The remaining signal was `test-falcor` on that host. Opening **each** failing job's log (not the aggregate) showed all 4 were one tracked flake (`test_GBufferRTTexGrads_d3d12` + `3221225477`) with **zero** other failing tests. Then the control host — the one supposedly clean at 6/0 — produced the **same** signature 20 minutes later:

```
SLANGWIN4  test-falcor  02:06:16Z  FAILED
  renderpasses/test_GBufferRTTexGrads_d3d12  : FAILED (7.0 s)
  Mogwai.exe exited with return code 3221225477
```

⇒ the host divergence evaporated. Right fix: quarantine the flaky test. No host action.

## Rules

1. **Before quoting a failure ratio, sort the rows and look for a run of same-outcome rows at one end.** A clean pre/post split means you have two regimes, not one rate. Report the post-boundary window, and print its bounds.
2. **A remediation ask needs a *current-state* window, not a sweep-length one.** "Is it broken now?" and "how often did it break?" need different windows.
3. **Verify a host hypothesis by opening each failure's cause, not by comparing aggregate counts.** N failures that are all one known flake is a test problem wearing a host problem's shape.
4. **A control host is only clean until it isn't** — re-check the control at the time you make the claim. Mine was clean at the earlier read and dirty 20 minutes later.
5. Corollary to (1): when two probes of the same job disagree, check whether the earlier one caught it **non-terminal**. My "6 success + 1 in_progress" vs a reviewer's "7 success" wasn't a conflict — the job finished between the reads. Bucket `status` before `conclusion` and it's obvious.

## Why this class is dangerous

No outcome check catches it. The arithmetic is right, the population is right, the spread test passes — and the recommendation is still wrong, because the *window* silently encodes a state that no longer exists. The reviewer who caught it used my own rule against my own number, which is the only reason it surfaced before an operator acted.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785983982985-a-whole-window-failure-ratio-averages-across-a-sta.md`_
