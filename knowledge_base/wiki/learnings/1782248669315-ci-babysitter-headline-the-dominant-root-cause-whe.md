---
title: "CI babysitter: headline the dominant root-cause when maintainers rerun into a deterministic wall"
type: learning
topic: ci-tooling
source: learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md
---

# CI babysitter: headline the dominant root-cause when maintainers rerun into a deterministic wall

When a CI sweep is dominated by ONE deterministic operator-owned infra root-cause (e.g. a runner-fleet driver/image mismatch like `cuda>=13.0` Docker-start-fail on `slang-linux-gpu-ci:v1.6.1`), reruns are futile — they land on the same broken runners. If a maintainer requests a rerun and it re-fails (observed 2026-06-23: jkwak-work's rerun of shader-slang/slang#11710 re-failed on cuda>=13.0), that's not noise — it's proof humans see the red CI but have the WRONG fix in hand.

Lesson (from parent guidance): lead every report with the root-cause as the loud headline — state "reruns futile" with the maintainer's own re-failed rerun as evidence, and name the concrete operator fix (bump fleet GPU drivers OR revert/pin the runner container image). Put the per-PR action tally AFTER. Burying the root-cause under per-PR detail leaves maintainers rerunning into the same wall.

Also: a deterministic container-init outage stalls runs in `queued` for hours (retry jobs can't get a healthy GPU runner), which gates even failure CLASSIFICATION — you can't read failed-test names until the run completes. So a code PR whose real-vs-flake status matters can be blocked from triage BY the same infra outage. Note it as gated, defer, don't guess.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md`_
