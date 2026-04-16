---
name: onboard-coworker
description: Create coworkers from pre-packaged YAML definitions or build new ones. Scans coworkers/ directory for available definitions, lets user select which to create. Use when user wants to spawn coworkers, onboard agents, or set up a team.
---

# Onboard Coworkers

Scans `coworkers/` for pre-packaged YAML definitions and creates agent instances. Also supports creating new custom coworkers.

## Important Constraints

1. **`/workspace/project/` is READ-ONLY.** Type definitions and templates live in the project root.
2. **CLAUDE.md is system-composed.** Never write CLAUDE.md directly. User instructions go in `.instructions.md`.
3. **Template inheritance.** Types extend other types via `extends` — templates, focusFiles, and allowedMcpTools merge from ancestors.

## Key Files (READ-ONLY reference)

| File | Purpose |
|------|---------|
| `coworkers/*.yaml` | Pre-packaged coworker definitions (from skill branches) |
| `groups/coworker-types.json` | Registry of all coworker types |
| `groups/templates/instructions/` | Reusable instruction overlays |
| `container/skills/*/SKILL.md` | Container skills available to all coworkers |

## Phase 0: Discovery

Before asking the user anything:

1. **Scan `coworkers/` directory** for `.yaml` files — these are pre-packaged coworker definitions
2. Read `groups/coworker-types.json` and list existing types with descriptions
3. Scan `groups/` for already-spawned instances
4. List instruction overlays from `groups/templates/instructions/`

Present as a formatted summary:

```
Available pre-packaged coworkers (coworkers/):
  [ ] <yaml-name-1>         — <summary from scanned YAML>
  [ ] <yaml-name-2>         — <summary from scanned YAML>
  [ ] <yaml-name-3>         — <summary from scanned YAML>
  ...

Already created:
  ✓ <existing-folder> (groups/<existing-folder>/)

Instruction overlays available:
  - thorough-analyst
  - terse-reporter
  - code-reviewer
  - ci-focused
```

Then ask using AskUserQuestion:
- **"Create from YAML"** — select pre-packaged coworkers to create
- **"Create custom"** — build a new specialist from scratch

## Phase 1: Create from Pre-Packaged YAML

For each selected YAML file:

1. Read the YAML file from `coworkers/{name}.yaml`
2. Check `requires.coworkerTypes` — verify all types exist in `coworker-types.json`
3. Check `requires.projectOverlays` — verify overlay directories exist
4. Ask user for optional customizations:
   - Instruction overlay (from `groups/templates/instructions/`)
   - Custom instructions (appended after overlay)
   - Custom folder name (defaults to YAML's `agent.folder`)
5. Create the agent:

```
mcp__nanoclaw__create_agent(
  name: "<from YAML>",
  coworkerType: "<from YAML>",
  instructions: "<overlay + custom instructions>"
)
```

### Batch creation

If user selects multiple coworkers, create them in sequence. After all are created, optionally wire them for peer communication:

```
mcp__nanoclaw__wire_agents(agent_a: "worker-a", agent_b: "worker-b")
```

## Phase 2: Create Custom Coworker

For coworkers not covered by pre-packaged YAMLs:

1. Ask: name, description, parent type (extends), focus files, MCP tools
2. Create with `create_agent`:

```
mcp__nanoclaw__create_agent(
  name: "Custom Specialist",
  coworkerType: "<existing-type-to-extend>",
  instructions: "<custom domain-specific instructions>"
)
```

3. To make the custom coworker reusable, tell the user to:
   - Add the type to `groups/coworker-types.json` with `extends`
   - Create a YAML file in `coworkers/` for future re-creation
   - Create a role template `.md` file

## Phase 3: Verify

After creation:
1. Check the coworker appears in your destination list
2. Send a test message: `<message to="coworker-name">introduce yourself</message>`
3. Verify it responds with the correct role-specific behavior

## YAML Format Reference

```yaml
version: 3

agent:
  name: "Display Name"
  folder: "folder-slug"
  coworkerType: "type-from-registry"

requires:
  coworkerTypes:
    - "type-name"
    - "parent-type"
  projectOverlays:
    - "project-name"

instructions: |
  Domain-specific instructions.
  Analyze issues and propose fixes.

trigger: "@folder-slug\\b"

destinations:
  - name: "parent"
    type: "agent"
    targetFolder: "main"
```
