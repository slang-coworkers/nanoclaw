# [approver/infra-abstain] devin-fetch.sh can exit 0 on a skeleton-loading page — "Checks N/N" is not a done-signal for the AI-analysis panel

## Symptom

Running Devin Review over shader-slang/slang#11118 via
`nanoclaw-pr-review-runner/scripts/devin-fetch.sh`, the script **exited 0** with an
**empty Flags panel** — a silent false-clean. The real analysis had 5 Investigate
flags + 2 Informational, several of which materially shaped the approval decision
(the `Ref` no-fallback path, the `[__NonCopyableType]` blast radius, the
substitution-ordering inconsistency).

## Root cause

The script's `DONE_EXPR` accepts a `Checks \d+/\d+` match as sufficient evidence
the page has finished rendering. On Devin's review page those are two independent
async regions:

- the **Checks** counter can reach `47/47` while
- the **AI-analysis / Flags** panel is still skeleton-loading, and in this case was
  additionally behind an unclicked **"View results"** button.

So the done-signal fired on a region unrelated to the content being harvested. This
is the same failure class the script's own comments warn about for an earlier
premature-exit regression — the guard was added for one region and the other
regressed.

Consequence for the approver: a `DEVIN_SKIPPED`/timeout is handled correctly
(Devin is best-effort, note it and fall through), but an **exit-0-with-empty-flags**
is *worse than a failure* — it presents as a clean signal and can silently remove
the only head-current review input on the fallback tier. On a Devin-only tier
(harvest exit 20) that is a direct path to a false WOULD_APPROVE.

## How to catch it

- **Treat exit-0-with-empty-findings as suspect, never as clean.** If
  `devin-flags.md` has no flags AND no explicit "no findings" statement, re-check
  the page before believing it. A genuinely clean Devin run says so.
- When driving the browser manually: click **"View results"** and expand the Flags
  panel, then re-extract. That was the fix here.
- Generalizable: a scraper's done-signal must key on **the region you are
  extracting**, not on any region that happens to settle. Prefer a positive
  assertion about the target content (a flag row, or an explicit empty-state
  string) over a sibling counter.
- Delegate the Devin run to a subagent (the workflow already requires this for
  context hygiene) but instruct it to distinguish "0 flags, explicitly stated"
  from "flags section absent" in what it returns — those are different results.

## Fix

- Re-extracted after clicking through; got the real 7-item flag set and used it.
- Recorded for the runner: `DONE_EXPR` keying on `Checks \d+/\d+` is insufficient
  for the flags harvest; it needs a target-region assertion (flag rows present, or
  an explicit no-findings marker) before declaring done.
