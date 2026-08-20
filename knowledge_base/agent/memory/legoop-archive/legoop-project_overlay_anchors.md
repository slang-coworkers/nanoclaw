---
type: project
title: "Overlay insert-before/insert-after targets require {#anchor-id} on workflow step headings. Without it, composer warns \"none of its anchors m"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Overlay insert-before/insert-after targets require {#anchor-id} on workflow step headings. Without it, composer warns "none of its anchors match steps" and gate markers don't render.

Overlays use `insert-before: [anchor]` / `insert-after: [anchor]` to splice critique gates into workflows. The composer matches these against `{#anchor-id}` annotations on workflow step headings.

**Required format:**
```markdown
## Step 5: SEND to parent (MANDATORY) {#send}
```

**Overlay references lowercase:**
```yaml
insert-before: [send]
```

Without `{#send}` on the step heading, the overlay warns: "none of its anchors [send] match steps []" — the gate renders but not inline at the correct position.

**How to apply:** Every workflow step that an overlay needs to gate must have a `{#id}` anchor. Check existing overlays' `insert-before`/`insert-after` arrays to see what IDs they expect. See `container/workflows/implement/WORKFLOW.md` for reference (`{#change}`, `{#diagnose}`, `{#deliver}`).

