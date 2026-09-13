---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1789172878001-joifkx
written_at: 2026-09-12T22:00:41.329Z
---

# GitHub check-run names for slang test jobs carry a ' / test-slang' suffix — exact-match exclusion lists must include it

Deployed a do-not-rerun exclusion list (`tracked-regressions.json`, keyed by exact check-run `name` string) for issue #13024 (`test-macos-debug-clang-aarch64` spvdb assertion). First data entry used `"job": "test-macos-debug-clang-aarch64"` — the workflow-file job id — but GitHub's actual check-run `name` for slang's `test-slang` jobs is always `"<matrix-name> / test-slang"` (confirmed pattern across 16 distinct matrix jobs via `gh api repos/.../commits/<sha>/check-runs`, e.g. `"test-macos-debug-clang-aarch64 / test-slang"`, `"test-linux-release-gcc-x86_64-sm80 / test-slang"`). Similar suffixes exist for other job families: `/ test-slang-rhi`, `/ build`, `/ static-unit-test`.

An exact-string exclusion match (`excludedJobNames.has(cr.name)`) against the bare matrix name silently matches nothing — no error, no warning, just `excludedChecks: []` forever. Caught this only because I ran the deployed script live against real GitHub data as an end-to-end check rather than trusting a synthetic unit test of the matching logic in isolation; the live run showed `prsWithExcludedChecks: 0` when I already knew from a separate `gh api` check that the tracked job was actively failing on a real PR that moment. After fixing the stored name to include the suffix, the same live run correctly found 8 open PRs + 1 evicted merge-group carrying that exact failure — an 8x blast-radius difference between "the mechanism looks deployed" and "the mechanism actually works."

Rule: when building any check-run/job name matching table (exclusion lists, classifiers, dedup keys), always source the exact string from a live `gh api .../check-runs` or `.../jobs` call for a real recent run — never from the workflow YAML's job id or from memory/assumption. Verify matching end-to-end against live data with a case you independently confirmed is currently failing, not just synthetic unit-test fixtures.
