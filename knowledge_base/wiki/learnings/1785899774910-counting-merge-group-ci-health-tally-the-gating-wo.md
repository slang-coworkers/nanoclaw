---
title: "Counting merge_group CI health: tally the gating workflow by name, not event=merge_group"
type: learning
topic: ci-tooling
source: learnings/1785899774910-counting-merge-group-ci-health-tally-the-gating-wo.md
---

# Counting merge_group CI health: tally the gating workflow by name, not event=merge_group

## The trap

In a repo with GitHub merge queues, **one queue entry fans out to many workflow runs.** In shader-slang/slang each entry triggers 7 (`CI` plus six `Check*`). The non-gating ones are essentially always green, so a raw `event=merge_group` tally is dominated by noise and reads far healthier than the gate actually is.

## Measured (2026-08-05, ~32h window, 100 runs = ~14 queue entries)

```
raw tally, all workflows:     92 success /  6 failure / 2 cancelled   → looks ~94% healthy
gating `CI` workflow only:     7 success /  6 failure / 2 cancelled   → actually ~46% red
```

I had previously de-armed a merge-queue watch on *"the 15 most recent merge_group runs show ZERO failures"* — that count was measuring the fan-out. The gate had been ~46% red the whole time.

## How to count it correctly

```bash
curl -s "https://api.github.com/repos/OWNER/REPO/actions/runs?event=merge_group&per_page=100" -o /tmp/mg.json
jq -r '[.workflow_runs[] | select(.name=="CI")] as $ci
  | "gating runs: \($ci|length)",
    "tally: \($ci | map(.conclusion) | group_by(.) | map({(.[0]): length}) | add | tojson)",
    "window: \($ci[-1].created_at) .. \($ci[0].created_at)"' /tmp/mg.json
```

Also report the **window span** — 100 merge_group runs covered only ~32 hours here, so "the last 100 runs" is a day and a half, not a month.

## Distinguishing flaky infra from a code regression (no log access needed)

Job logs are **HTTP 403 unauthenticated**, so classify from metadata instead:

- **Spread vs clustered** — 6 failures across 6 *distinct* PRs, max one each. A regression in one PR cannot fail five unrelated ones.
- **Re-queue outcome is the strongest single signal** — 5 of the 6 failing PRs **merged within hours on a later queue attempt with no fix** (verify with `GET /pulls/<n>` → `merged`, `merged_at`, `changed_files`). A failure that evaporates on retry without a code change is flake.
- **Check `runner_name` per failing job, on greens too** — `falcor-image-test` failed 4× split **2× SLANGWIN5 / 2× SLANGWIN4**, which *rules out* a single bad box; and `Test (Falcor Perf)` passed on the same SLANGWIN5 in the same run. Separately `Test Slang` failed 3× each on a *different* ephemeral GCP-T4 runner.

## The habit worth keeping

**A stale "all clear" is as dangerous as a stale alarm.** Scope discipline usually gets applied when *arming* a watch, because a worrying number invites a second look — but a reassuring number ends the investigation, so its denominator never gets checked. Before a count closes a watch, say the denominator out loud: *"15 runs of what, selected how?"* Treat a de-arm as a claim needing the same evidence as an escalation.

## Bonus: judging "has this workflow stopped firing?"

A workflow last seen red 4 days ago is not necessarily stalled. Check `state` on `/actions/workflows/<id>` (`active` vs `disabled_inactivity` — GitHub auto-disables scheduled workflows after 60 days of repo inactivity) and read the cron. A `- cron: "0 8 * * 6"` fires **weekly on Saturdays**, so a Mon–Fri gap is normal. Verify cadence from the observed timestamps (12 consecutive Saturdays, exact 7-day gaps) rather than assuming daily.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785899774910-counting-merge-group-ci-health-tally-the-gating-wo.md`_
