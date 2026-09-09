---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-11T01:57:08.482Z
---

# [approver/infra-abstain] A review INPUT captured after the PR merged is a Step-2 integrity failure — STALE_STAGE outranks any challenger finding, and never timestamp a file you're still editing

## Symptom

On slang-rhi#826 R2 the PR merged mid-decision. I worked through three states before landing:

1. **WOULD_APPROVE** — cleared the reviewer's one open flag.
2. **ABSTAIN_POLICY:OPEN_GAP** — critique found the flag was real; recorded that.
3. **ABSTAIN_INFRA:STALE_STAGE** — critique then established that the *recorded* state was
   still wrong, because the review input itself postdated the merge.

Only the third is correct, and the reason is structural rather than a matter of judgement.

## Root cause

The decision procedure orders its steps for a reason: **Step 2 checks harness integrity and
short-circuits before Step 3's challenger runs.** A review input drawn from an
already-terminal PR fails that check. So a challenger finding derived on that stage — however
substantive, however well-traced — **cannot be the row's verdict**, because the stage it was
derived on was never eligible to produce one.

I resisted this. My `OPEN_GAP` was a real, source-traced defect and felt far more informative
than a bookkeeping abstain, so recording the "boring" infra state seemed like losing
information. That instinct is the trap: **which finding I consider most interesting has no
bearing on which state the procedure yields.** The fix is to record `STALE_STAGE` *and* relay
the `OPEN_GAP` as a secondary observation — the substance reaches the maintainer without
laundering a contaminated row into a scoreable verdict.

## Two checks that would have caught it earlier

**1. Distinguish which artifact is late.**
- *Write-up* postdates the outcome → recoverable; the evidence may still be clean.
- *Evidence* postdates the outcome → the stage is dirty; no verdict is available.

So timestamp the **input** artifacts (scrapes, fetched logs), not the decision document. Even
better, look for clock-independent proof: my capture literally contained the string `Merged`,
which settles it without trusting any mtime.

**2. Never cite the mtime of a file you are still editing.**
My "corrected, measured" mtime table listed `decision.md`, `investigation.md`, and
`review-doc.md` — the three files I was actively revising. Every subsequent edit falsified the
table I had just written to establish rigour. **Timestamps are only evidence for immutable
artifacts.** A self-invalidating measurement is worse than no measurement, because it reads as
verified.

## Ledger mechanics worth knowing

I attempted `record_decision` for `OPEN_GAP`, the host **denied** it, then I attempted
`STALE_STAGE`. That is not an append-only violation: **a denial is not a row.** The
append-only rule binds on what *landed*, not on what was attempted, so a corrected state can
be re-recorded freely when the prior attempt was refused. Check whether the earlier write
actually succeeded before assuming you are stuck with it.

## The rule

When the outcome lands during your decision, ask **"was any input to my verdict produced after
the outcome was known?"** If yes, the state is a named infra abstain excluded from scoring, and
your substantive findings become a hand-off rather than a verdict. Prefer that over the
verdict you'd rather record — a contaminated row counted as agreement corrupts calibration in
the direction that flatters you.
