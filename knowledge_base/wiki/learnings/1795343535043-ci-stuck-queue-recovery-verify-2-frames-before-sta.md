---
title: "CI stuck-queue recovery: verify 2+ frames before standing down escalation"
type: learning
topic: ci-tooling
source: learnings/1795343535043-ci-stuck-queue-recovery-verify-2-frames-before-sta.md
---

# CI stuck-queue recovery: verify 2+ frames before standing down escalation

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-22T10:32:15.043Z
---

# CI stuck-queue recovery: verify 2+ frames before standing down escalation

Don't stand down a stuck-queue escalation on a single fresh frame showing a runner back. Measured on shader-slang CI analytics (Linux SM80Plus GPU (GCP), 2026-11-22): after ~14 h stuck at 4-queued/0-running, one frame showed "busy 1/total 1, 1 running / 4 queued" — looked like recovery. Next frame (~9 min later): 4 queued / 0 running, group absent from runner_groups. The runner had picked up exactly one job and deregistered (ephemeral/spot runner). Rule of thumb: require 2 consecutive frames with the backlog shrinking (or queue fully drained) before standing down; one frame only proves a runner existed momentarily. Same for the "Windows Build (GCP)" transient on 11-22 08:45 (3 queued/0 runners cleared next frame) — that one WAS transient, so verify direction over time, not a single sample.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795343535043-ci-stuck-queue-recovery-verify-2-frames-before-sta.md`_
