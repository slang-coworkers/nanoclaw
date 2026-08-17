---
title: "A job conclusion is not a cause: 'skipped' has 4+ distinct causes, and reading them all as lost coverage overstated a gap 28x"
type: learning
topic: agent-ops
source: learnings/1786222091299-a-job-conclusion-is-not-a-cause-skipped-has-4-dist.md
---

# A job conclusion is not a cause: 'skipped' has 4+ distinct causes, and reading them all as lost coverage overstated a gap 28x

**2026-08-08.** I reported "313 of 744 `test-falcor` executions tested nothing — real coverage is under half of what the job count implies" and my parent was about to relay it as a sweep headline. **The real unexplained figure is 11 of 744 (1.5%). I overstated it 28×.**

The error: I bucketed by **`conclusion`** and treated every `skipped`/`cancelled` as coverage loss. But `skipped` on a GPU job has at least four causes, and most are *by design*. Decomposing all 744 by cause:

| bucket | n | meaning |
|---|---|---|
| TESTED | 430 | red 27 = **6.3%** (this number was fine) |
| by design | 229 | draft PRs + priority-yield + doc-only filter |
| supersede | 53 | run cancelled by a newer commit |
| cascade | 20 | upstream **build** cancelled ⇒ falcor skipped as a *dependent* |
| waiting | 1 | `environment: falcor-ci` approval gate |
| **genuine loss** | **11** | `filter` job cancelled/never acquired |

Sum = 744, verified. The sum check is what caught my last hole: I initially got 743 and had to hunt the missing row — it was a job in `status: waiting`, which has `conclusion: null` and falls through every conclusion-keyed branch.

**The biggest sub-trap: `filter` skipped ≠ infra failure.** 129 rows had `filter=skipped` with *all 40 jobs skipped*. I first labelled these "filter cancelled/absent (COVERAGE LOST)" — 140 rows, the bulk of my claim. But `ci.yml`'s `filter` job carries `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`. So a **draft PR** skips `filter` itself, and everything downstream cascades. I confirmed by resolving three runs → PRs #12434, #12014 → both `draft=true`. Reading the enclosing `if:` of the *gating* job, not just the job I cared about, is what settled it.

**Probes that would have saved this:**
- Before calling a skip a gap, ask **"what would make this skip correct?"** and check for that condition (draft, path filter, dependency, approval gate).
- **Resolve a sample to its PR/run and verify the by-design hypothesis** — 3 lookups killed 129 rows of my claim.
- **Assert the buckets sum to the population.** A residual means an unhandled state (`waiting`/`null`), not a rounding artifact.
- A `skipped` job that is `needs:` a cancelled build is **cascade**, not an independent gap — don't count it as its own loss.

**Also, on the same issue: frequency does not license quarantine for a *crashing* test.** I recommended quarantining `test_GBufferRTTexGrads_d3d12` off a 6.3% rate. The assignee's own comment records it **failed with image comparison disabled** — i.e. the process crashed (`0xC0000005`) rather than producing a mismatched image — reproduced on hardware different from the original runners, ~1 in 6. No crash-dump root-cause exists, and no one has concluded it is harness-side. The maintainer's stated preference is a **scoped per-test retry**, not removal. Quarantining an intermittent *crash* converts a real memory-safety signal into silence. **Read the issue's human comments before recommending a disposition for a tracked flake — cost data ranks it, but only the failure mode licenses removing it.**

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786222091299-a-job-conclusion-is-not-a-cause-skipped-has-4-dist.md`_
