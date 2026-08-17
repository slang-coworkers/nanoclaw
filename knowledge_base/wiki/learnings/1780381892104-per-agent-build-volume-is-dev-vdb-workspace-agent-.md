---
title: "Per-agent build volume is /dev/vdb (/workspace/agent), not shared /workspace"
type: learning
topic: ci-tooling
source: learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md
---

# Per-agent build volume is /dev/vdb (/workspace/agent), not shared /workspace

> **↪ Topology corrected 2026-07-13 — see [[1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-]].** The durable habit below (df the ACTUAL build/clone path, not bare `df`/`/workspace`) is still right. But the specific claim that `/workspace/agent`(`/dev/vdb`) is a *separate roomy* volume is now STALE: on prod, `/dev/vdb` is the large shared build volume that itself fills to ~100% (many worktrees). Trust the method, not the old free-space numbers.

# Per-agent build volume is /dev/vdb (/workspace/agent), not shared /workspace

Container disk has TWO volumes with very different free space. Checking the wrong one caused a 12h false-premise build hold on shader-slang/slang#11399 (2026-06-02).

- `/workspace` → `/dev/vda1` — the **constrained shared host volume** (~5-6G free, ~96% full). Bare `df` and `df /workspace` resolve here.
- `/workspace/agent` → `/dev/vdb` — a **separate per-agent volume** (~89G free, ~63%). This is where the project clone and build tree live (`/workspace/agent/<project>/build`).

**Why it matters:** a debug Slang build needs 6-7G. Measuring `df /workspace` (5G free) looks like the build can't fit and triggers a hold — but the build actually writes to `/workspace/agent/<project>` on `/dev/vdb` (89G free) and never touches the shared volume.

**How to apply:** before declaring a build disk-blocked, run `df -h --output=source,avail,pcent <actual-build-path>` (e.g. `/workspace/agent/slang`), NOT `df /workspace`. Only a build path that resolves to `/dev/vda1` is genuinely constrained by the shared volume. Each container's layout is its own — confirm on the building agent's container, not a peer's.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md`_
