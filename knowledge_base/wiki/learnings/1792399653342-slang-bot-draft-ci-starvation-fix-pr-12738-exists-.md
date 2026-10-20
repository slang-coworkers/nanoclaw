---
title: "Slang bot-draft CI starvation: fix PR #12738 exists; waiting runs drain only by 30-day timeout; Ubuntu image only visible in job log header"
type: learning
topic: slang-compiler
source: learnings/1792399653342-slang-bot-draft-ci-starvation-fix-pr-12738-exists-.md
---

# Slang bot-draft CI starvation: fix PR #12738 exists; waiting runs drain only by 30-day timeout; Ubuntu image only visible in job log header

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-19T08:47:33.342Z
---

# Slang bot-draft CI starvation: fix PR #12738 exists; waiting runs drain only by 30-day timeout; Ubuntu image only visible in job log header

From the 2026-10-19 CI-health sweep:
- The bot-draft CI deadlock (`ACTIVE_STATUSES` in `extras/ci/ci_priority_common.py:29` counts `waiting`, so `ci-retry-yielded-bot` always logs "CI is still active (N run(s)); not rerunning bot CI") already has a fix: **shader-slang/slang#12738** by szihs. It changes 1 file (+14/−1) and has been open since 08-25. It is ready, not draft, but has 0 reviews, no requested reviewers, and is 300+ commits behind master. Point owners at it rather than proposing a new fix.
- The `waiting` count (85 on 10-18, 76 on 10-19) drains only through GitHub's 30-day pending-deployment timeout. `falcor-build-approval-gate` fails 30 days after creation with "The deployment was rejected or didn't satisfy other protection rules." New bot dispatches add about 6 a day, so the count never reaches 0 without a human cancelling them.
- The bot dispatch "CI success" since 10-01 ran only `filter` + `check-ci` (48 jobs skipped). Count jobs that were not skipped, not the run conclusion.
- To find which Ubuntu image an `ubuntu-latest` job got, read the job log header (`##[group]Operating System`, `Image:`, `Version:`). A ranged GET (`Range: bytes=0-6000`) on `/actions/jobs/<id>/logs` is enough. `runner_name` and `labels` do not show the OS. On 10-19 (rollout day 1), all 137 jobs were still Ubuntu 24.04.5, image 20261012.334.1.
- Through the OneCLI proxy, non-shader-slang repos (e.g. `actions/runner-images`) return 401 Bad credentials. Use WebFetch on the github.com HTML page instead.
- Ubuntu 26 was already validated for slang PR CI in #13288/#13347 (closed 10-01). That excluded scheduled workflows, `regenerate-cmdline-ref`, slangpy and slang-rhi (whose lavapipe legs are the riskiest). Search with no date filter before saying "no prep issue".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792399653342-slang-bot-draft-ci-starvation-fix-pr-12738-exists-.md`_
