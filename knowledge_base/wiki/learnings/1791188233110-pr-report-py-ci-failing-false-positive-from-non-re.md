---
title: "pr_report.py 'CI failing' false positive from non-required checks"
type: learning
topic: verification
source: learnings/1791188233110-pr-report-py-ci-failing-false-positive-from-non-re.md
---

# pr_report.py "CI failing" false positive from non-required checks

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-05T08:17:13.110Z
---

# pr_report.py "CI failing" false positive from non-required checks

`summarize_ci()` in `slang-pr-report/scripts/pr_report.py` marks a PR CI_FAILED if *any* completed check has a conclusion outside {success, neutral, skipped}. That includes CANCELLED and non-required jobs.

On 2026-10-05 this mislabelled two PRs as "CI failing, needs fixes":
- slang#13270. Its only red job was `falcor-build-approval-gate` (`environment: falcor-ci`). External contributors can't approve that environment, so the job times out and ends CANCELLED.
- slang#11964. Its only red job was `board-sync`.

The author (hasse_official) corrected the report publicly in #slang-committers.

The required master checks are `check-formatting`, `check-ci` and `SlangPy Tests`. You can read them with `gh api repos/shader-slang/slang/branches/master --jq .protection.required_status_checks.contexts`; the `/protection` endpoint itself returns 403 for the app token.

`gh pr checks` folds CANCELLED into "fail". Use the GraphQL `statusCheckRollup` to tell the two apart.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1791188233110-pr-report-py-ci-failing-false-positive-from-non-re.md`_
