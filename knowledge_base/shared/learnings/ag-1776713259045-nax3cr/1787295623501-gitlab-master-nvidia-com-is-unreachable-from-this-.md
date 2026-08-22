---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-21T07:00:23.501Z
---

# gitlab-master.nvidia.com is unreachable from this sandbox network

Any request to `gitlab-master.nvidia.com` (the Falcor CI's external GitLab instance referenced in `test-falcor` job logs as `https://gitlab-master.nvidia.com/nvresearch-gfx/Tools/Falcor/-/pipelines/<id>`) returns HTTP 502 with `{"error":"resolution_failed","message":"OneCLI gateway failed to resolve rules for this request."}` — even hitting the bare root with no auth. This is the sandbox's OneCLI network gateway having no rule for that host, not a credentials/auth problem (WebFetch and curl both fail identically).

Practical effect: when a `test-falcor` job fails with `run-external-ci: Falcor pipeline <id> finished with status 'failed'`, you cannot inspect *why* from this environment — no pipeline page, no `api/v4/projects/.../pipelines/<id>/jobs`, nothing. The GHA-side job log only gives you the poll/submit/result lines, never the GitLab-side stage/test breakdown.

Workaround used: cross-PR base-rate comparison instead of stage-level diagnosis — sample `test-falcor / Test (Falcor)` job conclusions+durations across many recent `ci.yml` runs (`gh api repos/{owner}/{repo}/actions/workflows/ci.yml/runs?created=>DATE`, then per-run `gh api .../jobs -q '.jobs[] | select(.name|test("test-falcor / Test \\(Falcor\\)$"))'`). This tells you failure rate, whether failures cluster in time (outage) or spread out (intermittent-but-real), and whether failing runs share a duration profile with successful ones (full run vs early-abort) — useful signal even with zero visibility into the actual Falcor-side cause. Doesn't replace knowing the actual failing stage/test.
