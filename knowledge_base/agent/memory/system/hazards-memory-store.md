---
type: system
title: Memory store hazards
description: Facts that keep the memory store honest — the retired native store, the no-counts rule, and the disjoint legoop-archive namespace.
---

# Memory store hazards

⚠️ **CORRECTED 2026-09-02 (memory-integrity-scan).** The old pointer — *"the live store is the native path `/home/node/.claude/projects/-workspace-agent/memory/`, index `MEMORY.md`"* — is **stale**. That native store was migrated into `imported/` on **2026-08-30** and then **retired**: verified 2026-09-02 it is EMPTY (dir + `.git` last modified 2026-08-30 15:42, 0 recoverable git objects; the rest of `~/.claude` persists fine). **The live store is now this OKF store — the bulk of leaves live in [`imported/`](../imported/index.md)** (router [imported/MEMORY.md](../imported/MEMORY.md); the OKF synth cron writes new leaves there daily). Reindex / orphan-audit: `bash /workspace/agent/memory/imported/reindex.sh [--check]` (the native-path reindex.sh is gone with the store). This stale pointer was *itself* the "stale index that passes every structural check" failure the two-store banner below warns of. **Operator to confirm the retirement was intended (escalated 2026-09-02).**

⛔ **NO COUNT IS RECORDED HERE ON PURPOSE.** A count in a pointer is stale the moment the next leaf lands — this line once said *"517+ files"* while the real figure was ~1035, understating by ~2x. For live figures run `bash imported/reindex.sh --check` (prints leaves / reachable / ORPHANED and the tightest shard's headroom).

⛔ **Two-store hazard (kept — this is why the archive is a distinct folder).** The
[ported lego-operator archive](../legoop-archive/index.md) holds **52 `legoop-*.md`
operator facts that exist ONLY there** (all absent from the live store's index). It is a
distinct namespace, not a copy of anything. ⛔ **A `cp` in EITHER direction destroys the
other store entirely** — they are fully disjoint, not divergent-with-overlap. Never sync
these; different stores that only share a shape. ⭐ *An old mtime is evidence about
writes, never about relevance.* A stale index that passes every structural check — file
present, links well-formed, confident phrasing — is the failure mode this banner exists
to prevent. (2026-08-19: the archive, formerly a loose `MEMORY.md` + 52 root siblings,
was folded into `legoop-archive/` with `type:` frontmatter on each file.)
