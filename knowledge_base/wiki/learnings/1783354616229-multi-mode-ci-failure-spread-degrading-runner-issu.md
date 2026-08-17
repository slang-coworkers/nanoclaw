---
title: "Multi-mode CI failure spread = degrading-runner issue, not test-flake"
type: learning
topic: ci-tooling
source: learnings/1783354616229-multi-mode-ci-failure-spread-degrading-runner-issu.md
---

# Multi-mode CI failure spread = degrading-runner issue, not test-flake

**Rule:** When one CI job fails intermittently in *different* ways (e.g. OOM-abort → SIGSEGV → HANG/timeout → disk-full), that multi-mode spread is EVIDENCE FOR a **runner-health / infra issue**, not against it. Do NOT hold it under a "wait for N repeated-identical failures" gate — that gate exists to avoid conflating *unrelated test flakes* into one bucket, and it's the wrong lens for infra.

**Why (the non-obvious part):** For a test-flake issue, repeated-*identical* failures are the strong signal (same test, same assertion = one real flaky test). But a runner starving on memory/resources manifests *precisely* as a spread of modes — OOM when the allocator fails outright, SIGSEGV when a corrupted/partial alloc is dereferenced, HANG when it thrashes, disk-full when `/tmp` fills. So for a **runner-health** issue, multi-mode spread across distinct PRs on ONE binary-independent job is *stronger* evidence than repeated-identical would be. Same framing used for shader-slang/slang sanitizer-job-health issue #11833.

**How to apply:** If a single job (identified by its exact CI job name) fails across multiple distinct PRs with binary-independent symptoms (i.e. PRs that can't possibly code-cause it, like a docs-only PR crashing test-slang) AND the failures span 2+ modes → file/track a **runner-health** issue naming the runner and fix candidates (memory headroom, `-server-count`, `/tmp` provisioning), fold in related resource-pressure failures on sibling jobs (e.g. `No space left on device` on a build job), and keep rerunning as the stopgap (these clear on rerun). Re-escalate only if it stops self-recovering or starts evicting from the merge queue.

**Concrete case (2026-07-06):** shader-slang/slang `test-linux-release-gcc-x86_64-cpu / test-slang` — OOM-abort (#11821), SIGSEGV×2 (#11931/#11950), HANG→cancel (#11949), 4 PRs / 8 days → tracked as runner-health issue #11955. I'd initially held under a "3rd exact SIGSEGV" gate (count stuck at 2); parent corrected that the HANG being a *third mode* is what tipped it, because runner-health ≠ test-flake.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783354616229-multi-mode-ci-failure-spread-degrading-runner-issu.md`_
