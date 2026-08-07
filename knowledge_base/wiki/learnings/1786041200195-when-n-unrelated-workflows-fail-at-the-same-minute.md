---
title: "When N unrelated workflows fail at the same minute, check githubstatus.com before diagnosing your diff"
type: learning
topic: misc
source: learnings/1786041200195-when-n-unrelated-workflows-fail-at-the-same-minute.md
---

# When N unrelated workflows fail at the same minute, check githubstatus.com before diagnosing your diff

**Measured 2026-08-06 on shader-slang/slang PR #12200.** Four `github.ci_failed` webhooks arrived on
one SHA (`c1bb185a0f`), each a **different check-suite**: a priority-yield, `PR Maintenance`/`board-sync`,
`Verify PR Labels`, and `CI SlangPy Trigger Test`. Investigated individually, three looked like
unrelated one-offs and the fourth (`Verify PR Labels`) looked plausibly **mine** — the `pr:` label is
the bot's responsibility, so that one nearly got a code-side fix.

**Root cause was none of them: GitHub Actions was in a MAJOR OUTAGE.**
`https://www.githubstatus.com/api/v2/summary.json` → incident "Incident with Actions", impact
**critical**, started **15:22:49Z**: *"Workflow runs are still failing or delayed in starting, and some
queued jobs may time out."* Every affected run postdated it.

**The tell I should have read sooner:** three separate workflows all reported job conclusion
**`cancelled`** — `check-pr-label`, `filter`, `trigger-slangpy-tests` — at the same minute.
`cancelled` is not `failed`; nobody cancelled them and the diff cannot cancel a job. And `filter` is
the gate every build/test job depends on, so the entire `CI` suite sat `queued` behind it.

**Rules**
- ⭐⭐ **When several independent workflows fail the same way in the same minute, suspect the PLATFORM
  before your change.** One `curl` of `githubstatus.com/api/v2/summary.json` retired four separate
  investigations. Cost of the check does not fall as your confidence in a code explanation rises.
- ⭐ **Read the JOB conclusion, never the run-level `ci_failed` envelope.** All four runs reported
  `completed/failure` at run level while the underlying jobs were `cancelled` or a deliberate
  yield-stop step. `cancelled` ≠ `failed`.
- ⭐ **Filter the PR's `statusCheckRollup` to non-`SKIPPED` and look for a passing counterpart before
  treating any red as live.** This PR carried BOTH a FAILURE and a SUCCESS `board-sync`, and both a
  CANCELLED and a SKIPPED `check-pr-label`.
- ⛔ **Do not rerun, rebase, or "fix" anything against outage-era runs** — they are artifacts, not
  signals. Wait for recovery, then re-read the checks.
- ⚠ **Webhook delivery is itself delayed during such an incident**, so arrival order ≠ event order.
  Don't infer causality from the sequence in which webhooks land.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786041200195-when-n-unrelated-workflows-fail-at-the-same-minute.md`_
