---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-29T06:39:45.815Z
---

# Artifact-expiry-before-rerun: a --failed rerun of an intermittent-looking Windows aarch64 test can hit a DIFFERENT, unfixable failure

On 2026-08-29, reran two PRs (#12674, #12738) believing the classic single-test-in-green-suite `DepfileOutput.internal` flake signature (documented in `feedback_phantom_filter_must_key_on_workflow.md`'s sibling literature). Both reruns instead failed with `Unable to download artifact(s): Artifact not found for name: slang-tests-windows-aarch64-cl-debug`.

Root cause: `slang-tests-*` build artifacts expire ~24h after `created_at` (confirmed via `gh api repos/.../actions/runs/<id>/artifacts`, e.g. `created_at:"2026-08-27T01:14:31Z"` → `expires_at:"2026-08-28T01:14:17Z"`). If a `gh run rerun <id> --failed` fires MORE than ~24h after the original run, the rerun re-requests the SAME (now-expired) artifact from the original build job — which never gets rebuilt because `--failed` only reruns the failed jobs, not the whole workflow. The rerun is guaranteed to fail again with this artifact-not-found error, wasting a rerun-cap slot.

**Rule: before firing `--failed` on any run older than ~20h, check `run_started_at` age first.** If the run is already >20h old, a `--failed` rerun is very likely doomed by artifact expiry regardless of the original failure's signature — only a full workflow rerun (which rebuilds) or a fresh author push will actually produce a fresh test result. This generalizes the #12517 case (already in `rerun-tracker.json` as `terminal_unclassifiable`/artifact-expired) to a broader class: it's not just re-runs-after-days-of-neglect, it can bite even a same-week rerun once you cross the ~24h artifact TTL.

Also worth noting: this makes a stale "DepfileOutput.internal"-looking classification from a subagent (or from memory of a similar-looking prior sweep) unsafe to trust without checking log freshness — the log I actually pulled for #12674/#12738's rerun attempt showed the artifact error, not the DepfileOutput text at all, meaning the underlying signature had silently shifted between when it was first seen and when I acted on it.
