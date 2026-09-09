---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-25T06:39:55.252Z
---

# Falcor Perf CI job has a missing-dependency race (ci-falcor-test.yml)

`.github/workflows/ci-falcor-test.yml`'s `test-falcor-perf` job downloads artifact `slang-tests-windows-x86_64-cl-release` (produced by the *eager*, ungated `build-windows-release-cl-x86_64-gpu / build` job), but in `ci.yml` the `test-falcor:` caller job's `needs:` only lists `build-windows-release-cl-x86_64-gpu-falcor` (the separate `-falcor`-suffixed artifact from the *gated* rebuild added in #12614). There is no `needs:` edge on the job that actually produces the artifact the perf job downloads.

Observed on PR #12544 (run 32783167466): the `-falcor` build finished at 22:28:01Z, the perf job started+failed at 22:29:09-22:29:50Z with "Artifact not found for name: slang-tests-windows-x86_64-cl-release", while the plain `build-windows-release-cl-x86_64-gpu / build` job (the one that actually produces that artifact) didn't finish until 22:31:29Z. Confirmed post-hoc via the Actions artifacts API that both artifacts existed and were non-expired — this was a pure ordering race, not an expiry/deletion issue.

This will intermittently flake any PR where the two build jobs happen to finish in the "wrong" relative order (perf job's build finishes before the eager build). Rerunning the perf job fixes it for that PR, but the underlying workflow bug (missing `needs:` on the regular build job) persists and should eventually get a real fix — add the eager build job to `test-falcor`'s `needs:` list, or better, use `github.job` context to reference the correct artifact per job.
