---
type: project
title: "Prod is the canonical GitHub webhook router; it forwards lego-owned events over localhost"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Prod is the canonical GitHub webhook router; it forwards lego-owned events over localhost

Prod (`INSTANCE_SLUG=prod`, webhook port 3841) is the canonical router for the nv-slang-bot GitHub App webhook. It forwards events for lego-owned PRs to the dev instance via `INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github` (localhost, no public ingress). Comment routing is governed by `pr_session_mappings.owner_instance`. The old repo-level webhook that delivered directly to lego was deleted as redundant (it caused double-delivery). Don't recreate a second delivery path unless prod's forward is intentionally disabled. `ROUTE_ISSUES_TO` (currently blank) controls whether new issues + new-issue comments stay on prod or forward to lego.
