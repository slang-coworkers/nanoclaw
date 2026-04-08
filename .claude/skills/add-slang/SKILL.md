---
name: add-slang
description: Add Slang shading language compiler support. Multi-agent coworker system with 10 specialist roles, container skills for building/navigating the Slang repo, MCP-based maintainer workflows, and coworker orchestration. Triggers on "add slang", "slang compiler", "slang support", "shader compiler".
---

# Add Slang Compiler Support

This skill adds the Slang shading language compiler multi-agent system to NanoClaw.

## Phase 1: Pre-flight

### Check if already applied

```bash
ls container/skills/slang-build/SKILL.md 2>/dev/null && echo "ALREADY_APPLIED" || echo "NEEDS_INSTALL"
```

If `ALREADY_APPLIED`, skip to Phase 3 (Verify). The code changes are already in place.

## Phase 2: Apply Code Changes

### Ensure slang remote

```bash
git remote -v
```

If `slang` remote is missing, add it:

```bash
git remote add slang https://github.com/szihs/nanoclaw.git
```

### Merge the skill branch

```bash
git fetch slang skill/slang
git merge slang/skill/slang || {
  # Resolve package-lock.json conflicts if any
  git checkout --theirs package-lock.json 2>/dev/null && git add package-lock.json
  git merge --continue
}
```

This merges in:
- `container/skills/slang-build/` — clone, build, navigate Slang (SKILL.md, build.md, structure.md, gotchas.md)
- `container/skills/slang-explore/` — compiler pipeline tracing, backend architecture
- `container/skills/slang-maintain-release-report/` — MCP-based daily reports, release notes, SPIR-V/GitLab updates
- `container/skills/slang-templates/` — coworker orchestration hub with 10 specialist role templates
- `.claude/skills/onboard-coworker/` — interactive wizard for creating new coworker roles
- `.claude/skills/add-slang/patches/` — composable CLAUDE.md layers
- `groups/coworker-types.json` — role registry

If the merge reports conflicts, resolve them by reading the conflicted files and understanding the intent of both sides.

### Patch CLAUDE.md files

The Slang sections are stored as separate patch files and appended programmatically — this keeps the base CLAUDE.md files clean and makes updates composable.

```bash
# Append Slang project section to global/CLAUDE.md (for all coworkers)
GLOBAL_MD="groups/global/CLAUDE.md"
GLOBAL_PATCH=".claude/skills/add-slang/patches/global-append.md"
if ! grep -q "Slang Compiler Project" "$GLOBAL_MD" 2>/dev/null; then
  printf '\n---\n' >> "$GLOBAL_MD"
  cat "$GLOBAL_PATCH" >> "$GLOBAL_MD"
  echo "Appended Slang section to global/CLAUDE.md"
fi

# Append orchestration section to main/CLAUDE.md (for coordinator)
MAIN_MD="groups/main/CLAUDE.md"
MAIN_PATCH=".claude/skills/add-slang/patches/main-append.md"
if ! grep -q "Slang Coworker Orchestration" "$MAIN_MD" 2>/dev/null; then
  printf '\n---\n' >> "$MAIN_MD"
  cat "$MAIN_PATCH" >> "$MAIN_MD"
  echo "Appended orchestration section to main/CLAUDE.md"
fi
```

### Rebuild container

The Dockerfile includes cmake, ninja, python3, lcov, sudo, and GitHub CLI:

```bash
./container/build.sh
```

### Validate

```bash
npm run build
npx vitest run
```

All tests must pass before proceeding.

## Phase 3: Verify

### Check skills loaded

```bash
ls container/skills/slang*/SKILL.md
ls container/skills/slang-templates/templates/*.md | wc -l  # should be 10
```

### Check coworker types

```bash
cat groups/coworker-types.json | head -20
```

### Test coworker types

```bash
cat groups/coworker-types.json | node -e "const t=require('fs').readFileSync('/dev/stdin','utf-8');Object.entries(JSON.parse(t)).forEach(([k,v])=>console.log(k+': '+v.description))"
```

## Phase 4: Configuration

### Slang repo access

Coworkers clone and build the Slang repo inside their containers using the `/slang-build` skill. No host-side clone or mount configuration is needed.

### Configure MCP server (for maintainer workflows)

AskUserQuestion: Do you have a slang-mcp server for GitHub/GitLab/Discord/Slack access? The maintainer skill uses MCP tools for daily reports and release management.

If yes, ensure the MCP server is configured in the container's `.claude/settings.json`. If no, maintainer workflows that require external access will be limited to what's available via `gh` CLI (GitHub token required in `.env`).

## After Setup

### Spawning coworkers

From the main chat, users can spawn specialist coworkers:

```
@Andy spawn slang-ir investigate-generics "Investigate generic type inference in the IR"
```

### Available specialist roles

| Type | Focus |
|------|-------|
| `slang-frontend` | Lexer, parser, semantic checking |
| `slang-ir` | IR system and passes |
| `slang-backend` | Code generation (HLSL, GLSL, SPIR-V, CUDA, Metal, etc.) |
| `slang-type-system` | Type system and generics |
| `slang-capabilities` | Capability system and resource tracking |
| `slang-language` | End-to-end language features |
| `slang-testing` | Test infrastructure and coverage |
| `slang-api` | Public API and COM interfaces |
| `slang-doc` | Documentation |
| `slang-build` | Build system and CI/CD |

### Creating new roles

Use the `/onboard-coworker` skill to create entirely new coworker types.

## Dashboard

AskUserQuestion: Would you like to add the Pixel Office dashboard? It provides real-time visualization of your coworkers as pixel-art characters in an isometric office, with live tool use indicators and activity timelines.

If yes, invoke the `/add-dashboard` skill.
