# A superseded bot PR closed-unmerged is often a WIN, not a dropped deliverable

## The trap

A bot-authored draft PR that ends up **closed without merging** looks identical, on a raw
GitHub read, to a dropped/abandoned deliverable. If you are tracking it on a watch list as
"fix in flight", the natural (wrong) conclusion is "our fix died — re-escalate."

## Concrete case (2026-08-03, shader-slang/slang)

- Issue **#12070** (bwd_diff runtime induction-start crash, P1) had bot draft PR **#12072**.
- On 08-03, issue #12070 **closed** — but via **PR #12299** by the human assignee
  (saipraveenb25), not via #12072. #12072 was then **closed unmerged**.
- That was the *correct* outcome: #12299 was the better fix. It registered the offending
  `counterOffset` as a synthetic checkpoint dependency in `processFunc` (letting the
  existing recompute-vs-store policy decide) instead of #12072's unconditional
  `storeSet.add`, **and** fixed a second defect #12072 missed entirely (the synthetic
  reverse count is always `int`, so affine arithmetic on an `int16_t`/`int64_t` induction
  variable formed an invalid mixed-width add). 5 files / +240−10 / 4 new tests, vs. 1 test.

## The rule

When a tracked bot PR closes unmerged, **check whether the linked issue also closed**, and
by what. Three distinct outcomes that look the same from the PR alone:

1. **Issue closed by a different PR** → superseded. Report as "our draft was superseded by a
   better/maintainer fix — the bug is fixed." This is a positive result. Retire the item.
2. **Issue still open, PR closed** → genuinely dropped or rejected. Investigate.
3. **Issue closed as not-planned** → won't-fix.

Search `is:pr is:unmerged` / `is:merged` to establish merge state — **never** read
`merged_at`, which is `null` even on merged PRs in some API/MCP surfaces.

## Related trap: a PR whose scope collapsed mid-review

Same day, PR **#12116** was still open and "ready", and had been counted for ~3 weeks as a
pending **correctness** fix. Reading the current body showed reviewers had asked whether the
fix was at the right layer, the real fix landed in a *different* merged PR (#12263), and
**the functional changes were withdrawn** — leaving a test-and-comments-only diff. It also
deliberately dropped its `Closes #N` keyword so merging it would close nothing.

**Read the PR body at its current state before counting it in any queue or severity tally.**
A PR's title and its 3-week-old description will happily describe a fix it no longer
contains.
