---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787656296203-j93n4i
written_at: 2026-08-25T11:43:46.539Z
---

# [approver/challenger-miss] Diff-scoped bot reviewers miss companion tests a code-only PR leaves stale

**Symptom:** shader-slang/slang#12727 (CI-analytics tooling: `extras/ci/analytics/ci_health.py`, `extras/ci/gh_api.py`) changed rendering/collection behavior and dropped the "STALLED" indicator tier. CodeRabbit (nit-only, 🔵 Low) and Devin (clean, 0 findings) both cleared it, and a human MEMBER approved "LGTM" at head. Initial approver read leaned WOULD_APPROVE. But the PR touched only its 2 non-test source files and left its own companion suite `extras/ci/analytics/tests/test_ci_analytics.py` (untouched) with 3 now-failing tests: an assertion for `>STALLED<`, and two mocks that break because a new code path (`get_pr_title`, merge_group pr_number resolution) now fires where the old tests assumed it wouldn't.

**Root cause:** The harvested bot reviewers are **diff-scoped** — they review the changed hunks, not the sibling test file that the diff does not touch. A behavior change that invalidates an existing test in an *unchanged* file is structurally invisible to them. And **CI carried zero bits**: no workflow runs this unit suite (`check-python-core.yml` only does `py_compile` + non-stdlib-import checks + compile-perf imports; a full `*.yml`@head scan found no unittest/pytest runner for it). So green CI + clean diff-scoped review + human LGTM all coexisted with a broken test suite.

**How to catch it:** For any PR that changes the *behavior* of a function or the *strings/labels/branches* an existing test asserts on, check whether a companion test file exists (e.g. `tests/test_<module>.py`, `*_test.*`, same dir) and whether the diff updates it. If the behavior changed but no test file is in the changed-file list, grep the test suite for the removed literal (here `STALLED`) and for the functions whose call pattern changed (here `get_pr_title`, `pr_number` on merge_group/fork runs). Do NOT let "CI green" stand in for "tests pass" until you've confirmed a workflow actually *executes* that suite — a `py_compile`/import-only check is green over a suite that never ran (the gate/flag positive-control lesson generalizes: a check that can't distinguish pass from never-ran carries no bits).

**Fix:** ABSTAIN_POLICY (OPEN_GAP), not WOULD_APPROVE and not BLOCK — the shipped product behavior is intended/correct (no runtime 🔴), but the change is incomplete: it leaves companion tests broken and a human must update them. This is the class "code-only PR changes behavior an existing (untouched) test asserts" → always check the sibling test suite and whether CI runs it.
