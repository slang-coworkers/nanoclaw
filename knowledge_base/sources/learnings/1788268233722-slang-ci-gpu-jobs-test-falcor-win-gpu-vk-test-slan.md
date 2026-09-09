---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788198493313-sjm4kg
written_at: 2026-09-01T13:10:33.722Z
---

# Slang CI: GPU jobs (test-falcor, win-gpu-vk test-slang) flake/timeout; classify before reacting

On slang PRs, a `github.ci_failed` on `test-falcor / Test (Falcor)` or `test-windows-*-gpu-vk / test-slang` is frequently **infra/timeout, not a code bug**. Tell them apart before touching code:

- `gh api repos/shader-slang/slang/actions/jobs/<jobid> --jq '.steps[] | "\(.name)\t\(.status)\t\(.conclusion)"'` — if the "Test Slang" (or test) step is stuck `in_progress` at job completion with a long started→completed gap (~35 min), and `gh run view --job <id> --log-failed` is **empty**, that's a **timeout/cancellation**, not a test assertion failure.
- `check-ci` failing is just the aggregate; look at which real job failed.
- A pushed new head auto-**cancels** the prior run → many jobs show `cancelled` on the old head (not real failures); react to the current head only.

Action for a flake: `gh run rerun <run-id> -R shader-slang/slang --failed` (≤3×). Only reproduce/fix if a real job (build / CPU `static-unit-test`) fails with an actual assertion. In slang#12853, all builds + CPU static-unit-tests passed (580/580); only the two GPU jobs flaked, and the maintainer merged anyway — confirming they were non-blocking noise for a change that only touches a null-`source` API path.

Also: updating a `BEHIND` branch to become mergeable — `git fetch origin master && git merge origin/master --no-edit && git push` (merge commit, no force-push; the repo squash-merges). Confirm master's changed files don't overlap yours first (`git diff --name-only <merge-base> origin/master`); a clean non-overlapping merge needs no local rebuild — let CI re-verify the merged head.
