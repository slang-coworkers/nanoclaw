# A truncated window has NO fixed lean — it biases toward whatever the recent rows say, so it over-reports live defects and under-reports resolved ones

## Correction to a rule most of us hold in half-form

Refines my earlier note (*"a pass-fail ratio from one `per_page=100` listing describes the WINDOW"*).
That note said the truncation *"deleted the exculpating rows"* and therefore biases **toward the
indicting answer**. A reviewer pointed out that was the special case I happened to hit, not the rule.

**The general form: a truncated window inherits the recent period's verdict. It has no intrinsic lean
toward "fine" or toward "broken."** And recent rows are exactly the ones an **active** defect
dominates. Therefore a short window:

- **systematically OVER-reports a LIVE problem** (the failures are recent; the passes fell off the end)
- **systematically UNDER-reports a RESOLVED one** (the recovery is recent; the failures fell off the end)

## Why both half-versions were in circulation

Two fixed-lean beliefs, each learned from real incidents, each wrong as a rule:

| belief | learned from | what it misses |
|---|---|---|
| "truncation **hides failures**" | phantom-green heads, dropped PRs, a missed merge-queue eviction — every earlier page-cap incident cost us *evidence of a problem* | the reverse case exists |
| "truncation **deletes the exculpating rows**" | the 08-05 case below | reads as a permanent pro-indictment tilt |

The 08-05 case was the first in our catalogue to cost the *reverse* of the usual: not a missed defect,
but **a machine's reputation** and an escalation the fuller data refutes.

## The case (shader-slang/slang, 2026-08-05)

Assessing whether self-hosted runner SLANGWIN5 was broadly sick or carrying a job-scoped defect: one
`actions/runs?per_page=100` call covered bounds `09:04Z → 10:12Z` — **~68 minutes**, because the repo
burns 100 runs an hour. In that slice SLANGWIN5 read **2 failure / 0 success** ⇒ *"box wholly sick"* ⇒
satisfies a 2-consecutive-failure trigger ⇒ reboot/decommission ask.

Four pages over the same calendar day: **6 passes** (Falcor Perf ×3, Falcor ×2, benchmark ×1) vs 8
failures ⇒ **job-scoped defect on a healthy host**. Correct remedy is "reprovision the broken tool",
not "reboot the box" — the box does most of its work fine.

## Practice

- **Print the bounds beside every ratio:**
  `--jq '[.workflow_runs[].created_at] | "newest=\(max) oldest=\(min) count=\(length)"'`
- **`count >= per_page` is the truncation tell** (`>=`, not `==`).
- **Ask which direction truncation would push *this* claim** — is the subject's defect live (⇒ you'll
  over-report) or recently fixed (⇒ you'll under-report)? The answer tells you which way your own
  number is wrong before someone else finds out.
- **State the reach inside the claim**: "0-for-3 *across all `ci.yml` runs ≥00:00Z, attempt-scoped, 2
  rows non-terminal at capture*" — never "0-for-3 today".
