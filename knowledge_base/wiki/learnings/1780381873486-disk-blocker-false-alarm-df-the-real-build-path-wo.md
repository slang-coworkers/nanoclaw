---
title: "Disk-blocker false alarm: df the real build path, /workspace/agent is a separate roomy volume"
type: learning
topic: ci-tooling
source: learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md
---

# Disk-blocker false alarm: df the real build path, /workspace/agent is a separate roomy volume

> **↪ Topology corrected 2026-07-13 — see [[1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-]].** The durable habit below (df the ACTUAL build/clone path, not bare `df`/`/workspace`) is still right. But the specific claim that `/workspace/agent`(`/dev/vdb`) is a *separate roomy* volume is now STALE: on prod, `/dev/vdb` is the large shared build volume that itself fills to ~100% (many worktrees). Trust the method, not the old free-space numbers.

# Disk-blocker false alarm: df the real build path, /workspace/agent is a separate roomy volume

**Before declaring a "disk full / can't build" blocker, run `df -h` on the ACTUAL build/clone path, not on `/workspace` or bare `df`.**

**Why:** In this container environment the mounts are split across devices, and the parent mount is the *constrained* one while the per-agent working volume is roomy:
- `/workspace` → `/dev/vda1` → e.g. 5.0G free, 96% (the SHARED host volume; also surfaces as `/app/src`)
- `/workspace/agent` → `/dev/vdb` → e.g. 89G free, 63% (separate PER-AGENT volume; your repo clone AND its `build/` tree live here)

`/workspace/agent` is a distinct sub-mount, so `df /workspace` (or `df` resolving to the shared volume) does NOT reflect the free space where a build actually writes (`/workspace/agent/<project>/build`). A 6–7G debug build that looks impossible against a `df /workspace` reading of 5G actually has ~89G of headroom on the per-agent volume.

**Incident (2026-06-02, shader-slang/slang#11399):** a fixer reported "/workspace at 95%, 6.5G free" and the chain held for ~12h (overnight + a restart + two timed-out operator escalations) waiting for disk to free — when the build directory was on a separate per-agent volume with ~89G free the whole time. The blocker was a measurement artifact (wrong mount), not a real resource limit.

**How to apply:** When any coworker reports a disk/build-space blocker: (1) `df -h <actual-build-dir>` (e.g. `/workspace/agent/<project>/build`), not the parent mount; (2) proceed if that path has ≥ build footprint headroom; (3) treat it as a real blocker only if the build path itself is genuinely on the constrained shared volume. Mounts can differ per container, so each coworker must verify on its own container. Never resolve a real shared-disk blocker by deleting sibling builds (cross-session hazard).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md`_
