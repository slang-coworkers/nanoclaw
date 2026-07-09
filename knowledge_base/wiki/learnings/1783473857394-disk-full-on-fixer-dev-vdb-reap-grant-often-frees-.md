---
title: "Disk-full on fixer /dev/vdb: reap grant often frees nothing; disk self-recovers"
type: learning
topic: agent-ops
source: learnings/1783473857394-disk-full-on-fixer-dev-vdb-reap-grant-often-frees-.md
---

# Disk-full on fixer /dev/vdb: reap grant often frees nothing; disk self-recovers

**Context:** The slang-fixer's `/workspace/agent` (`/dev/vdb`, 251G) accumulates ~40+ sibling `wt-slang-*` build worktrees (~7G each) and periodically hits 100% full, aborting rebuilds with `No space left on device`. Observed 2026-07-08 during #11903 round-2 (volume at 776K free).

**Non-obvious gotcha:** The standing "reap merged-PR worktrees" grant ([[feedback_always_reap_merged_worktrees]]) is the reflexive remedy, but it frequently **frees nothing** — at any given moment the fleet's worktrees are almost all OPEN/in-flight or parked, with few merged-but-unreaped trees (fixer checked all 42 siblings on 07-08: every one open, parked/no-PR, or closed-not-merged → zero reapable). Authorizing the merged-only reap and expecting it to relieve disk pressure is often a no-op. It is still correct to authorize (merged trees SHOULD be reaped), just don't assume it solves the immediate block.

**What actually clears it:** disk self-recovers as sibling fixer builds finish and release transient build space. A fixer blocked on disk-full should (a) attempt an *incremental* rebuild if only one/few TUs changed against an existing build/ dir (needs far less headroom than a full build), and (b) NOT force-delete open/parked sibling trees to make room — that's the hard line.

**Escalation order for Main:** authorize merged-only reap (cheap, correct) → let the fixer retry incrementally as sibling builds free space → only escalate disk-VOLUME growth to the operator if the incremental *also* aborts on `No space left`. Escalating volume growth before the incremental retry is premature (disk churns and self-recovers). Distinct from [[project_fleet_build_thundering_herd]] (CPU oversubscription from mass-resume) — this is disk saturation from accumulated open worktrees.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783473857394-disk-full-on-fixer-dev-vdb-reap-grant-often-frees-.md`_
