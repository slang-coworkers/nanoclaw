# A budget cap on a fan-out reviewer pipeline is structurally guaranteed to destroy the output it protects

# $40 then $82, both `error_max_budget_usd`, both zero recoverable findings

Two runs of the `slang-pr-review-runner` "Reviewer A" pipeline (shader-slang/slang PR #12336) died at
their budget cap without producing `final-review.md`:

| run | diff reviewed | cap | spend at death | domain passes completed | output |
| --- | --- | --- | --- | --- | --- |
| 1 | larger, pre-fix | $40 | $40.09 | 2 of N | 0-byte `final-review.md` |
| 2 | **2 files, +70/−8** | $60 | **$81.60** | **0** | no file at all |

The second run reviewed a *much smaller* diff at a *higher* cap and cost **more than double** — which is
the finding. It is not "the budget was too low."

## The structural defect

The pipeline dispatches six domain reviewers plus a clarity pass **concurrently and unbounded**, each
independently exploring the repo. Per-subagent transcript attribution for run 2:

```
ir-correctness  1.18MB   cross-backend 1.12MB   security 1.05MB   code-quality 0.76MB
doc-accuracy    0.74MB   clarity       0.71MB   general  0.67MB   test-coverage 0.60MB
```

All eight did 0.6–1.2MB of work. **None emitted a finding** — no `ReportFindings` tool_use blocks, no
severity/verdict prose anywhere in the 7MB transcript.

⇒ **Spend scales with reviewer-count × exploration-depth, not with diff size.** The cap is evaluated at
the top level, so it trips only *after* the fan-out has burned its tokens, and it kills the subagents
**before** their reporting step. The money goes on exploration; the value is entirely in the last few
percent (synthesis). **A dollar cap on this shape therefore always lands in the interval that destroys
the output it was meant to protect.** Raising it buys a larger bill with the same failure mode.

## What to do instead

- **Cap the fan-out, not the dollars.** Dispatch only the rule-applicable lenses. In run 2 two reviewers
  weren't even rule-applicable to the diff and burned **1.86MB of 7MB** between them.
- **One lens per invocation, each with its own budget.** Then a cap kills one pass instead of all eight,
  and every completed pass gets to report.
- **Make the reporting step cheap and early** — have each reviewer emit findings incrementally rather
  than only at the end, so a kill loses the tail rather than everything.
- **Before authorizing a re-run, ask what the first failure actually taught you.** If spend went *up* on a
  smaller input, budget is the wrong variable and a bigger number buys the same unknown twice.

## Generalizable

**A resource cap is only safe when the protected artifact is produced incrementally.** If a pipeline's
output exists solely at the end, any cap is a coin-flip between "finished" and "spent everything for
nothing" — and with concurrent fan-out the odds get worse as you add workers, because they all consume
budget before any of them reports. Check where in the lifecycle your artifact becomes durable *before*
picking a limit.

Corollary for the operator relationship: when told "if it hits the cap again, report spend-at-death and
which passes completed — don't raise it yourself", that instruction is what converts a second failure from
a bill into a diagnosis. Per-subagent spend attribution is the specific evidence that distinguishes
"needed more budget" from "the shape is wrong."
