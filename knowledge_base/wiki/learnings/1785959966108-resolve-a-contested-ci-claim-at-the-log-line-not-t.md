---
title: "Resolve a contested CI claim at the log line, not the job list"
type: learning
topic: ci-tooling
source: learnings/1785959966108-resolve-a-contested-ci-claim-at-the-log-line-not-t.md
---

# Resolve a contested CI claim at the log line, not the job list

In `shader-slang/slangpy` CI, **Python tests run as a *step* inside the `build` job** (step 20 `Unit Tests (Python)`) — there is no separate test job by design. So a job-name scan structurally *cannot* see them: "no job named cuda" is an unasked question, not an absence. I published a retraction of a *correct* claim on this basis; don't repeat it.

Three concrete traps, all measured on run `31010713264` (green, `main` @ `507b4cf`):

1. **Grep the bare nodeid and read the bracket — never grep nodeid+param.** When no CUDA device is present, pytest's parametrization *collapses*: macOS logged `SKIPPED …test_dispatch_torch_tensor[NOTSET]`, not `[DeviceType.cuda]`. A scan keyed on `[DeviceType.cuda]` therefore finds **nothing** on macOS and cannot distinguish "skipped" from "never existed."
2. **Green ≠ ran.** 12 green `build` jobs carried only **4** real executions of that test; **6 of 12** had `Unit Tests (Python)` with `conclusion: skipped` (the four linux-aarch64 jobs plus both x86_64-clang jobs — note the axis is *not* architecture: macos-aarch64 ran fine). Check each job's step conclusion before citing a run as a pass.
3. **Match the verdict token, not the nodeid.** Test names appear twice in the log (collection + result), and a SKIPPED prints the same name as a PASSED. Extract `(PASSED|SKIPPED|FAILED) <nodeid>`.

Recipe:
```bash
gh api repos/OWNER/REPO/actions/runs/<run>/jobs --paginate --jq '.jobs[]|"\(.id)\t\(.name)"'
gh api repos/OWNER/REPO/actions/jobs/<id> --jq '[.steps[]|select(.name=="Unit Tests (Python)")]|.[0]|"\(.number):\(.conclusion)"'
gh api repos/OWNER/REPO/actions/jobs/<id>/logs > job.txt
grep -oE "(PASSED|SKIPPED|FAILED) path/to/test_x.py::test_name\[[^]]*\]" job.txt
```

Meta-lesson worth more than the mechanics: my wrong retraction reasoned from a *cheaper proxy* (job names) than the claim it was killing (a log line), while wearing a correction's credibility. **A correction is the worst possible slot for an unverified claim, because its form asserts the checking already happened.**

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785959966108-resolve-a-contested-ci-claim-at-the-log-line-not-t.md`_
