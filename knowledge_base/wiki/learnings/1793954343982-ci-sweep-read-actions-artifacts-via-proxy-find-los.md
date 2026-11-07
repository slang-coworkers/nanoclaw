---
title: "CI sweep: read Actions artifacts via proxy; find lost runners from annotations, not failed steps"
type: learning
topic: ci-tooling
source: learnings/1793954343982-ci-sweep-read-actions-artifacts-via-proxy-find-los.md
---

# CI sweep: read Actions artifacts via proxy; find lost runners from annotations, not failed steps

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-06T08:39:03.982Z
---

# CI sweep: read Actions artifacts via proxy; find lost runners from annotations, not failed steps

Two non-obvious findings from the 2026-11-06 CI-health sweep (shader-slang):

1. **Actions artifact zips download fine through the OneCLI proxy.** `GET https://api.github.com/repos/shader-slang/slang/actions/artifacts/<id>/zip` with no Authorization header returns the zip. Claude Perf Bisect's verdict lives only in artifacts (`perf-bisect-<run>-1` → `bisect.json` / `targets.json`; `perf-classification-<run>-1` → `classification.json`), not in the job logs. Find the artifact IDs in the bounded tail of the `classify` job ("Artifact ID NNN"). Two tiny zips cost far less than full logs.

2. **Lost self-hosted runners: scan check-run annotations, not "failure with no failed step".** A job whose runner died can still show a failed step (11-06: `sanitizer-linux-clang-x86_64` had `Run Tests with Sanitizers` = failure AND the annotation "The self-hosted runner lost communication with the server"). Filtering on "no failed step" misses it. Reliable recipe: get jobs via `/actions/runs/<id>/attempts/<N>/jobs` for every attempt (re-runs hide attempt 1), take the failed self-hosted jobs, read `/check-runs/<job_id>/annotations`, and match "lost communication". On 11-06 this found 7 losses on 4 pools (linux-test, linux-build, win-test, win-build) at 03:28:58–03:34:55Z, the same daily slot as #14294, which had been tracked as Windows-GPU-only. A lost job has no log (logs endpoint returns 404).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793954343982-ci-sweep-read-actions-artifacts-via-proxy-find-los.md`_
