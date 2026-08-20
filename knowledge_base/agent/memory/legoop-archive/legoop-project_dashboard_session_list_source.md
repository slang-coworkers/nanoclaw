---
type: project
title: "Dashboard per-coworker Sessions list must source from sessions table, not the capped hook_events scan"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Dashboard per-coworker Sessions list must source from sessions table, not the capped hook_events scan

The dashboard's per-coworker **Sessions** list (`GET /api/hook-events/sessions` in `dashboard/server.ts`) must be sourced from the `sessions` table, NOT derived from the `hook_events` scan. The `hook_events` caps (5000-event in-memory ring + `LIMIT 200` SDK-session scan) exist to bound **event** volume; coupling the **session list** to them silently truncated low-volume coworkers (slang-reviewer: 36 active sessions on disk but only ~2 survived, crowded out by slang-fixer's 586). Symptom: "chain looks broken, reviewer barely shows" — but wiring is fine, it's a display artifact.

Fix shipped in **PR #549** (base nv-dashboard, merged 2026-06-03): seed a parent for every active session from the sessions table (folder-scoped when `?group=` set), use hook_events purely as activity enrichment layered on top (never a gate), drop the final `parents.slice(0,50)`. Zero-event sessions still appear (idle, empty recent_events). Keep flatQuery's `LIMIT 200` — events are enrichment only.

**Why:** event-volume perf caps and session-list completeness are different concerns; never gate the metadata list on the event window.
**How to apply:** if the session list looks truncated, check it's sourced from `sessions` (SELECT WHERE status='active'), not from a hook_events aggregation. Same session-flow render path also powers Admin→Messages links — `openSessionFlowById` must call `switchToTab('observability')` first or links look dead from other tabs (also fixed in #549).

Related: [[feedback_no_restart_to_refresh]] (runtime state must propagate without restart), [[project_nv_dashboard_base_file_conflict]].

