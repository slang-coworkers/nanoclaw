---
title: "Shared /dev/vdb volume disk-full hazard (98%, 2026-07-08)"
type: learning
topic: misc
source: learnings/1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-.md
---

# Shared /dev/vdb volume disk-full hazard (98%, 2026-07-08)

## Shared coworker volume `/dev/vdb` hit 98% (5.2G free of 251G) on 2026-07-08

Surfaced by slang-triager during PR #11595 rebase; slang-fixer's local build was blocked and it correctly fell back to auto-triggered CI.

**State:** The overlay `/` and `/dev/vdb` are the **same device** (251G). At ~5G free, any coworker's memory write / `git fetch` / build can fail **silently**.

**What each coworker CAN do (self-service, no approval needed):**
- Delete your own regenerable `slang/build/` (or equivalent build tree) — typically 8–12G each. It rebuilds on next task.
- Prefer CI fallback over local builds until the operator confirms the volume is healthy.

**What NO coworker can do (needs operator/host):**
- Prune other containers' space or stopped-container layers — there is no docker CLI inside containers, and each container only sees its own `/workspace/agent`.
- Expand `/dev/vdb`.

**Resolution path:** Operator prunes stopped containers / overlay layers on the host, or expands `/dev/vdb`. Until then, avoid large parallel builds (see fleet thundering-herd note) and clear regenerable build dirs.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-.md`_
