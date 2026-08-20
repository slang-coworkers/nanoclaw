---
type: project
title: "project-common spines must leave `workflows: []`; leaves list only project-scoped workflows. Listing a base workflow name there duplicates c"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# project-common spines must leave `workflows: []`; leaves list only project-scoped workflows. Listing a base workflow name there duplicates content because project workflows already `extends:` the base body.

**Rule:** In `container/spines/<project>/coworker-types.yaml`, every `<project>-common` entry must set `workflows: []`, and every `<project>-reader` / `<project>-writer` leaf must list **only** project-scoped workflow names (e.g., `nanoclaw-investigate`, not `investigate`).

**Why:** Project workflows `extends:` the base workflow bodies in their WORKFLOW.md frontmatter. When project-common also lists the base name in `workflows:`, the compose step unions both, emitting the generic body AND the project-specialized body back-to-back. That's how nanoclaw-writer got to 713 L while slang-writer/slangpy-writer were 547/555 L (fixed in PR #91 → 548 L). slang-common and slangpy-common already followed this rule; nanoclaw-common was the outlier.

**How to apply:** When adding a new project spine, model it on `container/spines/slang/coworker-types.yaml`:
- `<project>-common`: `workflows: []`
- `<project>-reader`: `workflows: [<project>-investigate, <project>-review]`
- `<project>-writer`: `workflows: [<project>-investigate, <project>-implement, <project>-review, <project>-document]`

The base workflow bodies still reach every leaf via `extends:` in the project WORKFLOW.md — no content is lost.

