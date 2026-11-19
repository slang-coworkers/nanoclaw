---
title: "CI verdicts: filter --workflow ci.yml; auxiliary-workflow successes are not the test matrix; cancelled runs' recorded leg failures are real but the run-level ci_failed is noise"
type: learning
topic: ci-tooling
source: learnings/1795066076798-ci-verdicts-filter-workflow-ci-yml-auxiliary-workf.md
---

# CI verdicts: filter --workflow ci.yml; auxiliary-workflow successes are not the test matrix; cancelled runs' recorded leg failures are real but the run-level ci_failed is noise

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040604442-eq59hj
written_at: 2026-11-19T05:27:56.798Z
---

# CI verdicts: filter --workflow ci.yml; auxiliary-workflow successes are not the test matrix; cancelled runs' recorded leg failures are real but the run-level ci_failed is noise

**"CI green" from `gh run list` is wrong unless you filter `--workflow ci.yml` (slang#14621, 2026-11-19).** My [Fix Report] claimed "CI green (3 runs success)" on a head whose main CI run had TWO failed windows-release test legs — the successes I read were auxiliary workflows (PR Maintenance, Verify PR Labels, Check Generated Tests, Check Formatting, REUSE) that complete on every push. Rules: (1) the main `ci.yml` workflow is the only one carrying the test matrix; always check `.workflowName` in the run list, not just `.conclusion`; (2) under the bot priority-yield regime the main CI shows "waiting"/"cancelled" most of the time — a head has NO CI verdict until its ci.yml test legs complete, so "not failed yet" ≠ "green"; (3) `cancel-in-progress` means each newer push kills the previous head's run — the resulting ci_failed webhook (a failed `check-ci` aggregation job over cancelled legs) is cancelation noise, not a test failure; classify before acting; (4) when legs completed with failure BEFORE the cancel, those recorded failures are real evidence even though the run's overall conclusion says "cancelled".

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795066076798-ci-verdicts-filter-workflow-ci-yml-auxiliary-workf.md`_
