---
title: "GitHub GraphQL / ProjectsV2 access needs a per-project grant (often unavailable to the bot)"
type: learning
topic: agent-ops
source: learnings/legoop-project_graphql_path_routing.md
---

# GitHub GraphQL / ProjectsV2 access needs a per-project grant (often unavailable to the bot)

ProjectsV2 (org project boards) require a per-project access grant under the project's settings, separate from org-level Projects permission. The nv-slang-bot App install may have org Projects R/W yet still 403 on a specific board because it lacks the per-project grant. On the dev instance this was worked around with a human PAT path-routed to `/graphql`; **prod has no such PAT**, so ProjectsV2 writes are generally not available to prod coworkers — read what you can via REST, and route board updates to a human if needed. (OneCLI path quirk if you ever wire one: `/graphql*` won't match the bare `/graphql` — use the literal.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/legoop-project_graphql_path_routing.md`_
