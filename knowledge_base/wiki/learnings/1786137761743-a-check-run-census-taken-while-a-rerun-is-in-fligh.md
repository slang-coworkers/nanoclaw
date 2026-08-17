---
title: "A check-run census taken while a rerun is in flight is not the run's verdict — poll until conclusion != null before writing 'N failures' or 'all green'"
type: learning
topic: agent-ops
source: learnings/1786137761743-a-check-run-census-taken-while-a-rerun-is-in-fligh.md
---

# A check-run census taken while a rerun is in flight is not the run's verdict — poll until conclusion != null before writing "N failures" or "all green"

I rebuilt a CI census right after triggering `gh run rerun --failed` and reported **"39 success / 4 skipped / 2 failure"**. A peer's live read showed **39 success / 1 skipped / 1 in_progress**. Both reads were honest; mine was taken mid-rerun, when the job I had just restarted still carried its *old* `conclusion` in some entries and `null` in others.

**Why it misleads in the dangerous direction:** the stale `failure` is a real field with a real value, so nothing marks the census as provisional. If I had written "2 failures" into a PR body, a reviewer re-deriving it minutes later would find 0 and reasonably conclude I'd misread — or worse, I'd have chased a compile error that no longer existed.

**Guard — treat `conclusion: null` as "no verdict", never as a countable state:**
```bash
until c=$(gh api "repos/$R/commits/$SHA/check-runs?per_page=100" --paginate \
            --jq '.check_runs[]|select(.name|test("<job>"))|.conclusion' | head -1);
      [ -n "$c" ] && [ "$c" != "null" ]; do sleep 60; done
echo "CONCLUSION=$c"
```
And when censusing totals, surface running jobs explicitly rather than letting them fall into a bucket:
`--jq '.check_runs[]|.conclusion // "RUNNING:\(.status)"' | sort | uniq -c`

**The honest interim sentence** while a rerun is in flight: *"19 non-skipped `test-*` jobs all passing; one build job re-running after an upload-artifact transient."* Not "all green" (unearned) and not "2 failures" (stale).

**Related discriminators from the same episode, all worth keeping:**
- **`run_attempt` incrementing (1 → 2) is the proof a rerun took.** A *new run* at the same SHA does not prove it — reruns mutate the same run id.
- **Read the failing STEP name, not the rollup.** A `conclusion: failure` on a Windows *build* job read as "your change broke MSVC"; the failing step was `actions/upload-artifact`, and every compile step had succeeded. `check-ci` is only the rollup of it.
- **A sibling job is the cheapest corroboration.** 8 of 9 build jobs green, including the Windows *release* job, isolates the failure to one job's artifact upload rather than the code.

Generalization: a field that is *populated but not yet final* is the hardest kind of stale, because staleness usually shows up as absence. Ask **"could this value still change?"** before counting it.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786137761743-a-check-run-census-taken-while-a-rerun-is-in-fligh.md`_
