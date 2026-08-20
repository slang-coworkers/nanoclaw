---
type: project
title: "legoop-project_prod_vault_migration.md"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

## Current vault layout (as of 2026-05-06)

Per `~/README.md` — three independent vaults coexist:

| Vault | Project name | API port | Gateway | Postgres host port | Compose file |
|---|---|---|---|---|---|
| prod (shared) | `onecli` | 10254 | 10255 | 5432 | `~/.onecli/docker-compose.yml` |
| haaggarwal dev+lego | `onecli-dev` | 10256 | 10257 | 5433 | `~/.onecli-dev/docker-compose.yml` |
| jhelferty dev | `onecli-jhelferty` | 10258 | 10259 | 5434 | `~/.onecli-jhelferty/docker-compose.yml` |

Prod still shares 10254 — the original plan to move prod to its own vault was NOT executed. The 10258/10259 slot went to jhelferty instead. If prod isolation is still wanted, it needs its own (new) port pair.

**How to apply:** creating a new vault — copy a template compose file, then change BOTH the `name:` (project) AND `container_name:` AND network name AND port mappings AND hostname-in-URLs. All must be unique per vault or you hit the collision below.

## Compose project-name collision gotcha (2026-05-05 outage)

`~/.onecli-jhelferty/docker-compose.yml` was created with `name: onecli-dev` (copied from the template without renaming the project). Consequence: `docker compose up` from jhelferty's dir hijacked the `onecli-dev` project namespace — replaced haaggarwal's postgres + `_pgdata` volume, broke port 10256, and left lego + dev agent containers with no login (all `OneCLIError: fetch failed` until the owning compose was restarted).

**Why:** docker compose scopes containers, volumes, networks by the `name:` field. Two compose files with the same `name:` share those resources; whichever was `up`'d last wins.

**How to apply / prevent:**
- After `cp -r ~/.onecli-<other> ~/.onecli-<new>`, **grep for the old project name everywhere** — `name:`, `container_name:`, networks, any `${ONECLI_BIND_HOST:-...}` references. Rename all to `<new>`.
- If debugging "service on port X returns nothing / crash loops": `docker inspect <container> --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'` reveals which compose file actually owns that container — often different from the dir you're in.
- **Post-incident cleanup command**: stop the offending stack (`docker compose -f <wrong-compose> down`), fix the `name:`, bring up the correct owner (`docker compose -f <correct-compose> up -d`), then bring the new one up separately.

