---
type: project
title: "legoop-project_session_may11.md"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

## Session 2026-05-11 summary

### PRs merged (#252–#261)

**nv-dashboard (#252, #253, #255):**
- Approval card post-click feedback (green "Approved" / red "Rejected" label)
- Fullscreen exit blank screen fix (closeThread removes cw-thread-fullscreen class)
- A2A session visibility — session_id param on /api/messages, messaging_group_id in session metadata, 💬 button for a2a sessions (read-only thread panel), URL deep-linking `#/cw/<folder>/s/<sessionId>`
- Thread stub "new" badge + "mark all read" link in sessions summary
- Sidebar unread dot uses cw.lastMessageTs (covers all sessions)
- Collapsible relay messages (Orch→PerfHound) with toggle-header, expanded state persists across 3s poll
- Self-echo a2a filter (sender = viewer removed from display)
- sys-* added to system ID prefix list
- Pixel Office active-only filter (24h threshold) + "Show all" toggle + click hit-test fix
- Inbox attachment rendering (buildMessageAttachments checks inbox/ for forwarded a2a files)
- Thread panel file attachment 📎 links
- Attachment builder works for both incoming and outgoing messages

**nv-main (#254, #256, #259, #260, #261):**
- Cross-coworker dashboard file+message forwarding in delivery.ts — when coworker A sends to dashboard:<coworker-B>, forwards to recipient's session with file copying via forwardAttachedFiles
- Owner-only routing — only forward to the agent group that owns the target dashboard MG (no broadcast storms)
- a2a_session_sources thread lookup — routes replies to the existing thread where the delegation originated
- bwrap sandbox fix: [features] use_linux_sandbox_bwrap=false in Codex config.toml + sandbox.enabled=false in group-init DEFAULT_SETTINGS_JSON
- codex_hooks=true experimental feature enabled

### Key debugging/operations
- NanoClaw overlay toggled off then back on
- SlangClaudeReviewer OneCLI: set to selective mode with GitHub (slang-coworkers, shader-slang) + Anthropic API secrets only (no szihs)
- PerfHound bwrap root-caused: Codex config.toml missing [features] section; Claude subagents missing sandbox.enabled=false in settings.json
- Slang-maintainer stuck at 99% CPU: --resume replaying broken MCP session; fixed by clearing continuation:claude from session_state in outbound.db
- Multiple HERMES++ misrouted message cleanups across sessions
- MCP management token file regeneration (data/.mcp-management-token)

### Architecture learnings
- a2a sessions have messaging_group_id=NULL and thread_id=NULL — invisible to dashboard without explicit support
- Dashboard adapter is outbound-only — cross-coworker messages need explicit forwarding in delivery.ts
- outbound a2a relay messages have thread_id=NULL even when stored in a per-thread session — row-level filter must accept NULL for inbound a2a
- Service restarts trigger skill refresh → CLAUDE.md recompose → claude-md-stale kills ALL running containers

