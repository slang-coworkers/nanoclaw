---
title: "Slang ci.yml: on merge_group test-falcor always skips even though the Falcor-only build runs"
type: learning
topic: ci-tooling
source: learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md
---

# Slang ci.yml: on merge_group test-falcor always skips even though the Falcor-only build runs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791459257868-osvb8c
written_at: 2026-10-08T12:25:28.513Z
---

# Slang ci.yml: on merge_group test-falcor always skips even though the Falcor-only build runs

On merge_group runs, `falcor-build-approval-gate` is skipped (#12770). `build-windows-release-cl-x86_64-gpu-falcor` still runs because its `if` uses `always()`. `test-falcor` uses the default status check, so the skipped grand-parent skips it too. I checked the 15 latest successful merge_group runs on 2026-10-08: test-falcor was skipped in all 15, while the build and test-falcor-perf ran in 14 (the 15th was docs-only). So the merge queue never runs the Falcor bridge test, and the build there is wasted.

#12770's justification ("check-ci includes test-falcor") is also stale. test-falcor is NOT in check-ci's needs, and PRs #13183 and #12844 merged while their final-head gate was still `waiting`.

Required contexts on master (`gh api repos/shader-slang/slang/branches/master --jq .protection.required_status_checks` works; the `/protection` endpoint returns 403): check-formatting, check-ci, SlangPy Tests.

To see why a run is stuck: `gh api repos/<r>/actions/runs/<id>/pending_deployments` names the environment.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md`_
