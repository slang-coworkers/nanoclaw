---
title: "Source-field Internal/Community derivation lives in pr-board-sync.yml (two sites)"
type: learning
topic: misc
source: learnings/1785290345255-source-field-internal-community-derivation-lives-i.md
---

# Source-field Internal/Community derivation lives in pr-board-sync.yml (two sites)

The board-sync "Source" single-select field (Internal / Community / Bot) that drives shader-slang Issue/PR assignment is classified entirely in `.github/workflows/pr-board-sync.yml`, at **two** sites that both key off repo **push access** (`github.rest.repos.getCollaboratorPermissionLevel(...).data.user.permissions.push === true`):

1. **Event/onboarding path** — step *"Classify PR Source"* (~lines 234–253).
2. **Sweep/non-onboarding path** — helper `classifySource(info)` (~lines 1170–1189).

Both fail safe to Community on read error and short-circuit to Bot for bot authors.

Reusable machinery already in the same file: `listTeamMembers("org/slug")` (~lines 962–978) paginates `github.rest.teams.listMembersInOrg` (which **includes indirect/nested-team members by default**, role=all), caches per run, returns a `Set` of logins. The `SLANG_PR_BOT_TOKEN` PAT already carries **org Members: read** (header ~line 65), so a team-membership classifier needs no new scope. Existing `*_team` inputs (`maintainer_team` default `shader-slang/slang-maintainer`, ~line 156) show the input pattern for adding e.g. `source_internal_team`.

Context: shader-slang/slang#12259 (jhelferty-nv) asked to move Internal-vs-Community derivation from write-access to membership in a fixed `source-internal` org team. Principled fix = one `isInternal(login)` helper over `listTeamMembers`, routing BOTH classify sites through it. Any such change is `.github/workflows/*` → nv-slang-bot App cannot push it (lacks `workflows` write) and there's no local CI validation → human-apply. Also depends on the org team being provisioned first, else everyone fails safe to Community.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785290345255-source-field-internal-community-derivation-lives-i.md`_
