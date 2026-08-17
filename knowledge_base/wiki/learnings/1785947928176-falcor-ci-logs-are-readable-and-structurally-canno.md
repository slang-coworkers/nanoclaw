---
title: "Falcor CI logs ARE readable — and 'structurally cannot' needs a second sample from the class"
type: learning
topic: ci-tooling
source: learnings/1785947928176-falcor-ci-logs-are-readable-and-structurally-canno.md
---

# Falcor CI logs ARE readable — and "structurally cannot" needs a second sample from the class

## The retracted claim

I reported — and my parent endorsed and forwarded upstream — that the `shader-slang/slang` Falcor CI
job is *"a pure poller, 2,245 bytes, structurally cannot contain a test name or crash code"*, so
crash evidence for the tracked #12145 flake had to come from NVIDIA-internal GitLab (unreachable
from our container).

**False.** 8 of 10 Falcor eviction logs over 7 days are **~309 KB** and name the failure outright:

```
renderpasses/test_GBufferRTTexGrads_d3d12                    : FAILED (7.2 s)
  ...\Release\Mogwai.exe exited with return code 3221225477
```

## Root cause of the error — structurally the worst possible sample

The single job I sampled belonged to **PR #11754, "Route Falcor CI through dedicated runner"**, whose
own diff (+6/−62 to `.github/workflows/ci-falcor-test.yml`) **deletes the real Windows Falcor job and
replaces it with one `/opt/slang-ci/run-external-ci` polling step**. I sampled the one PR that
*constructs* the unreadable variant, then generalized to the entire class. The PR title said exactly
what it did.

**Three classes, not two:**

| class | bytes | runner | steps | names the crash? |
|---|---|---|---|---|
| real run | ~309 KB | `SLANGWIN4/5` | 10 | ✅ |
| bridge poller | 2,245 B | `kernelvm-falcor-bridge` | 3 | ❌ polls GitLab |
| **expired** | **151 B** | any | **0** | ❌ **not a log** |

## ⛔ 151 bytes is an HTTP 410 error body, not a small log

```
{"message":"Server Error","documentation_url":"...","status":"410"}
```

`gh` exits **1** and writes to **stderr**; a grep over the body returns `0` hits with no sign of
trouble. Check the fetch exit code — and never let `$(...)` swallow stderr when a probe's emptiness
is load-bearing. When logs are expired, `output.summary` is null, the only annotation is a generic
`Process completed with exit code 1.`, and `steps` is empty (`steps_len: 0` vs 10 on a live job).
`runner_name` and timings do survive: both expired jobs ran 16.8–18.8 min on class-1 runners, inside
the confirmed 17.0–19.3 min band (n=8) — **probable, not confirmed.**

## The transferable method lesson

**Reproducing a finding on the same artifact is not sampling the population.** My parent confirmed my
reading on the artifact I handed them and never drew a second member of the class — the identical
error one level up, and the same confounded-sampling failure I had caught *them* in an hour earlier.

Before writing **"structurally cannot"**, draw a second member of the class. A one-artifact
generalization reads exactly like a measured limitation, and it propagates: mine reached the human
operator as a visibility limit that did not exist.

Practical: fetch the job id from the check-run's `details_url` (`/job/<id>`), not from a windowed
`actions/runs?event=merge_group` listing — the 100-row cap reached back only 5 of the 7 days needed
and returned a misleading "no run found" for 8 of 10 commits.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785947928176-falcor-ci-logs-are-readable-and-structurally-canno.md`_
