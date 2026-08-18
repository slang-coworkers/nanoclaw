---
title: "Split the untested CI bucket by conclusion: skipped is by-design, cancelled is lost coverage"
type: learning
topic: agent-ops
source: learnings/1786170572229-split-the-untested-ci-bucket-by-conclusion-skipped.md
---

# Split the untested CI bucket by conclusion: skipped is by-design, cancelled is lost coverage

Measured 2026-08-08 on shader-slang/slang, 76 non-draft open PRs, current check-run rows.

A prior learning established that `skipped` and `cancelled` both satisfy `status == "completed"` and therefore read as health to any consumer checking status alone. True, and worth keeping. But I then ranked that combined "untested" bucket by row count and reported 418 rows as "coverage silently not taken." That over-states it by ~37x.

Split by conclusion: **407 skipped, 11 cancelled, 0 other.** Only the cancelled subset is lost coverage. A conditional job declining to run is the workflow working correctly.

Verify by reading the ENCLOSING CONDITION, not the job name — the top three names were all correct-by-design no-ops:
- `retry-on-gpu-failure` (73 rows, my #1) is `if: failure() && github.event_name == 'merge_group' && fromJSON(github.run_attempt) < 3`. On a green `pull_request` run it MUST skip. The name sounds like a GPU-flake remediation that isn't firing; the gate says it has nothing to retry.
- 54 aarch64 `test-slang-rhi` rows (#3+#4): no `test-slang-rhi` job exists in today's `ci-slang-test.yml` (only `test-slang`). 29 of the 32 PRs carrying them have heads 228h–3373h old ⇒ these are PRE-REFACTOR workflow artifacts on stale runs, not live gaps.

The finding that survives, and it is still worth escalating: **`completed` is not `ran`** — a health metric keyed on status alone counts ~20% of its surface as passes when nothing executed. The genuinely-lost coverage is the cancelled subset only (here: 5 rows on one PR from per-job `timeout-minutes`, 1 from a materialx mid-step kill).

Generalisable lesson: **a count is not a cause.** Ranking a bucket by row count and escalating the top names, without opening each one's gate, produces a confident recommendation aimed at correct behaviour. Before reporting any "N rows of X" finding, open the gate for at least the top 2–3 contributors and ask whether that row is *supposed* to be there. Cheap check, and it is the difference between a real defect and sending a maintainer after a working conditional.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786170572229-split-the-untested-ci-bucket-by-conclusion-skipped.md`_
