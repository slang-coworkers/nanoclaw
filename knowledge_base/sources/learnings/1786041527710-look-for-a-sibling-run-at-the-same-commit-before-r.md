# Look for a sibling run at the SAME commit before reasoning about a CI failure's cause — and a rerun only informs if the step under test actually ran

Four CI-failure webhooks on one PR in an evening (slang#12155, 2026-08-06). I spent real effort on mechanism
arguments and cross-branch controls to show they were infra. The decisive evidence turned out to be two rows
sitting in the same API response the whole time.

**The free control.** Many workflows trigger on both `push` and `pull_request`, so a single commit gets **two
independent runs**. Here:

```
31121727201  pull_request  SUCCESS  runner 1000509863
   steps: Set up job | Build fsfe/reuse-action@v6 | Checkout | REUSE Compliance Check | Post Checkout | Complete job
31121725027  push          failure  runner ""   steps: []      ← never scheduled
```

Same commit, same file set, opposite outcomes, three seconds apart. **A content defect cannot pass and fail
simultaneously on one tree; a scheduling failure can.** No cross-branch comparison, no reasoning about what the
check does, no reading the diff — just two rows at one SHA.

```bash
gh api "repos/O/R/actions/workflows/<wf>.yml/runs?per_page=30" \
  --jq '[.workflow_runs[]|select(.head_sha=="<sha>")|{event,conclusion,id}]'
```

⚠ **Verify the passing sibling actually executed the check.** `conclusion: success` can be vacuous (skipped
jobs, filtered paths). Pull the step list and confirm the step you care about is present:
`--jq '.jobs[0]|{conclusion,runner:.runner_name,steps:[.steps[].name]}'`. A green with `steps: []` is the same
never-scheduled state as the red one.

**The mistake this replaced, which is the more important half.** Earlier I had reasoned: *"a real content defect
fails identically on rerun; a transient one passes — so rerunning discriminates."* I reran, both reruns failed,
and by my own stated test that meant the defect was real. It wasn't. My two-outcome test had **no cell for
"fails again without ever running the check."** Across four attempts, the step under test never executed once —
`Set up job` was the only step that ever ran, and it failed.

**So: a rerun is evidence about a defect only if the step under test actually ran.** Before reading a rerun's
verdict, check `steps[]` — the same field that identifies a never-scheduled job. Otherwise an infra failure
that recurs is indistinguishable from a reproduced bug, and the rerun actively misleads rather than merely
failing to inform.

**General form:** when designing a discriminating test, enumerate the outcomes the *instrument* can produce, not
just the outcomes the *world* can produce. My test partitioned the world (real defect | transient) and ignored
that the instrument could return "didn't measure." That third cell is where the wrong conclusion lived.

**And retract superseded status claims yourself.** I had told my parent "there has still been no license verdict
on this branch." Once the same-commit success landed, that became false — the check has now genuinely passed at
the current head. Correcting it unprompted is cheaper than letting a stale open item sit in someone else's
notes, and status claims about CI expire faster than almost anything else you'll assert.
