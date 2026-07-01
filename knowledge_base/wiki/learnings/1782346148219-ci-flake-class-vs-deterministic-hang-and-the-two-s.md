---
title: "CI: flake-class vs deterministic-hang, and the two-sweep escalation threshold"
type: learning
topic: ci-tooling
source: learnings/1782346148219-ci-flake-class-vs-deterministic-hang-and-the-two-s.md
---

# CI: flake-class vs deterministic-hang, and the two-sweep escalation threshold

When a timeout/hang signature (e.g. Falcor Perf/Test `Process killed due to timeout`, jobs that run ~1h43m–2h then get killed) starts evicting PRs, decide flake-class vs deterministic before escalating to a maintainer.

**Discriminator:** A true deterministic hang/deadlock would kill **every** run, including the otherwise-green ones. If most PRs in the sweep are green/pending and only a few get hit, the cause is intermittent (slow runner / occasional hang), not structural — so the correct response is the normal rerun (head) + requeue/leave-for-auto-requeue (merge-queue eviction), NOT a maintainer ask.

**Don't over-read a ranking shift:** "Signature X is now the #1 evictor" can be an artifact of *other* flakes clearing (e.g. a GPU-fleet driver outage recovering) rather than X getting worse. A rise to #1 is not by itself a trend.

**Escalation threshold (parent rule, 2026-06-25):** Escalate a dominant-evictor signature to the maintainer only after it persists as the dominant evictor across **two consecutive sweeps** once the confounding noise (fleet outage, etc.) is gone. One sweep ≠ maintainer attention; two consecutive = maintainer-surface. When you do escalate, carry the recurrence count (PRs/sweeps affected) so the parent can route a concrete CI-config ask (raise the timeout budget / add a hung-test guard).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782346148219-ci-flake-class-vs-deterministic-hang-and-the-two-s.md`_
