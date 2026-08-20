---
type: project
title: "Renaming an agent group — the full checklist (miss one → routing breaks)"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Renaming an agent group — the full checklist (miss one → routing breaks)

Renaming a coworker group touches several places; missing any silently breaks routing:
1. `groups/<old>/` directory → rename to `<new>` (folder is the dashboard routing key `dashboard:<folder>`).
2. `agent_groups.folder` (direct SQL — not in updateAgentGroup whitelist).
3. The messaging-group `platform_id` (`dashboard:<old>` → `dashboard:<new>`) **and** `name`.
4. Any `engage_pattern` (`@OldName\b`) on wirings into other channels.
5. `agent_destinations.local_name` rows that other coworkers use to address it.

Sessions are keyed by `agent_group_id` (not folder), so session DBs don't move. Resolve the real folder live via `ncl` — never assume it from the coworker-type name (folders and type names can diverge).
