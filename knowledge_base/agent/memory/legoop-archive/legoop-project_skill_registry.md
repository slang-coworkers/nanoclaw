---
type: project
title: "Skills migrating from nv-slang/nv-slangpy to shader-slang/slang-skills repo via gh skill install at build time"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Skills migrating from nv-slang/nv-slangpy to shader-slang/slang-skills repo via gh skill install at build time

Skills for slang/slangpy coworkers are moving from bundled (committed in nv-slang/nv-slangpy branches) to fetched from shader-slang/slang-skills at build time via `gh skill install`.

**Why:** Central repo for skills that works across agent hosts (Copilot, Claude Code, Cursor, Codex). NanoClaw-specific frontmatter (`provides`, `allowed-tools`) passes through — other hosts ignore it, our composer reads it.

**How to apply:**
- `coworker-types.yaml` declares `skill-source: shader-slang/slang-skills@<pin>` as default for all skills in that type
- Individual workflow `uses:` can override per-skill: `slang-build@v2`
- No version → type default → no type default → assume local
- `container/build.sh` resolves and fetches before docker build
- Fetched skills gitignored; `slang-maintainer-tools` stays local (NanoClaw-specific MCP bridge)
- Branch `coworkers` on shader-slang/slang-skills has all 11 skills (6 slang + 5 slangpy) with our frontmatter
- Only `slang-build` overlapped with upstream (merged both versions)
- 8 skills are workflow-required, 2 are docs (nice-to-have), 1 is NanoClaw-only

Related: [[feedback_overlays_project_generic]], [[project_spine_sibling_parity]]

