---
type: system
title: Standing hazards and corrections
description: Operational hazards and past corrections for the Orchestrator's memory and tooling — moved verbatim out of Core Memory on 2026-09-29 so Core Memory holds facts, not banners.
---

# Standing hazards and corrections

Moved verbatim from `memory/index.md` → Core Memory on 2026-09-29 (operator tidy). Core Memory now carries a
one-line fact for each item below; the full context, evidence and history stay here.

⚠️ **CORRECTED 2026-09-02 (memory-integrity-scan).** The old pointer here — *"the live store is the native path `/home/node/.claude/projects/-workspace-agent/memory/`, index `MEMORY.md`"* — is **stale**. That native store was migrated into `imported/` on **2026-08-30** and then **retired**: verified 2026-09-02 it is EMPTY (dir + `.git` last modified 2026-08-30 15:42, 0 recoverable git objects; the rest of `~/.claude` persists fine). **The live store is now this OKF store — the bulk of leaves live in [`imported/`](imported/index.md)** (router [imported/MEMORY.md](imported/MEMORY.md), ~1250 leaves; the OKF synth cron writes new leaves there daily). Reindex / orphan-audit: `bash /workspace/agent/memory/imported/reindex.sh [--check]` (the native-path reindex.sh is gone with the store). This stale pointer was *itself* the "stale index that passes every structural check" failure the two-store banner below warns of. **Operator to confirm the retirement was intended (escalated 2026-09-02).**
⛔ **NO COUNT IS RECORDED HERE ON PURPOSE.** A count in a pointer is stale the moment the next leaf lands — this line once said *"517+ files"* while the real figure was ~1035, understating by ~2x. For live figures run `bash imported/reindex.sh --check` (prints leaves / reachable / ORPHANED and the tightest shard's headroom).

✅ **Superseded 2026-09-27 (verified live 2026-09-29):** the host now bounds `readSessionMessages` (two-phase read: seq keys first, then content for the returned ≤`limit` rows; nanoclaw `e24a7ec64`, `9b0003065`). A `--reverse --json --limit 400` read of the dashboard session returned in ~1s with no wedge. Still avoid a large `--offset` (bounded, but costly). The history below is kept as the reason the rule existed.

⛔ **(Historical, pre-09-27) NEVER `ncl sessions messages` / `sessions get` on the main dashboard session `sess-1776713576150-9fon2n`** (or any huge old session). The read is unbounded, so `--limit` doesn't cap it. It wedges my session's host pickup and every later `ncl` call times out, including sends and task updates. This happened twice on 2026-09-26 (05:32Z, 13:33Z), and the second time the shared learning already existed. To find operator replies, grep `conversations/*.md` instead. Recovery: back up `/workspace/outbound.db`, then delete only my undelivered read-only `cli_request` rows. [learning](/workspace/shared/learnings/ag-1776713211742-1w6l4e/1790403484197-ncl-sessions-messages-on-a-huge-old-session-can-we.md)

Verified 2026-08-04: this file was the untouched OKF template ("Nothing stored yet"), dated Jul 15.

⛔ **Two-store hazard (kept — this is why the archive is a distinct folder).** The
[ported lego-operator archive](legoop-archive/index.md) holds **52 `legoop-*.md`
operator facts that exist ONLY here** (all absent from the live store's index). It is a
distinct namespace, not a copy of anything. ⛔ **A `cp` in EITHER direction destroys the
other store entirely** — they are fully disjoint, not divergent-with-overlap. Never sync
these; different stores that only share a shape. ⭐ *An old mtime is evidence about
writes, never about relevance.* A stale index that passes every structural check — file
present, links well-formed, confident phrasing — is the failure mode this banner exists
to prevent. (2026-08-19: the archive, formerly a loose `MEMORY.md` + 52 root siblings,
was folded into `legoop-archive/` with `type:` frontmatter on each file.)
