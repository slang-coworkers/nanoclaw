# NanoClaw v2 Coworker System

What we built on top of upstream v2, how it works, and how the branches relate.

## Branch Architecture

```
upstream/v2 (e07158e)
    │
    └── v2_main                        coworker infrastructure
            │
            ├── skill/v2_dashboard     Pixel Office dashboard (14th channel)
            │
            └── skill/v2_slang         Slang compiler multi-agent system
```

Each skill branch is independently mergeable onto v2_main. They don't depend on each other.

## What v2_main Adds (coworker infrastructure)

### Schema: migration 006

Two columns on `agent_groups`:
- `coworker_type TEXT` — e.g. `"slang-compiler"` or `"slang-language"`
- `allowed_mcp_tools TEXT` — JSON array of `mcp__server__tool` names

### MCP Registry (`src/mcp-registry.ts`)

Centralized lifecycle for MCP servers:
- Auto-detects stdio servers from `container/mcp-servers/` (by `pyproject.toml`)
- Auto-detects remote HTTP servers from `REMOTE_MCP_SERVERS` env var
- Spawns one supergateway process per server on loopback
- Tracks liveness (`alive` field), clears tool cache on exit
- Tool discovery via JSON-RPC `tools/list` after startup and after restart

### MCP Auth Proxy (`src/mcp-auth-proxy.ts`)

Per-container network-level ACL:
- Single HTTP server, binds to loopback (macOS) or 0.0.0.0 (Linux)
- Per-container bearer tokens scoped to specific MCP tools
- `tools/call` blocked if tool not in allowed set
- `tools/list` response filtered to only show allowed tools
- Management endpoints (`/tools`, `/servers`, `/servers/stop`, `/servers/restart`) — all require management token
- Token registered before container spawn, revoked on both `close` and `error`

### CLAUDE.md Manifest Composition (`src/container-runner.ts`)

4-layer composition for typed coworkers (runs once at creation, not every wake):
1. **Layer 0: Base** — `groups/templates/base/global.yaml`, rendered into `groups/global/CLAUDE.md`
2. **Layer 1: Sections** — `groups/templates/sections/*.yaml` (e.g. `web-formatting`, `coworker-extensions`)
3. **Layer 2: Project fragments** — `groups/templates/projects/*/{role,capabilities,workflow,constraints,formatting,resources}.yaml` plus optional `coworker-base.yaml`
4. **Layer 3: Role templates** — YAML files referenced by `coworker-types.json`

Explicit instructions from `create_agent` are stored as `.instructions.md` and merged into the composed Workflow section as an additional block.

`coworker-types.json` is mtime-cached to avoid re-parsing on every container wake.

### Per-Agent MCP Tool Filtering

Resolution priority:
1. Explicit `allowed_mcp_tools` from DB (JSON array)
2. Coworker type lookup from `coworker-types.json`
3. `DEFAULT_MCP_TOOLS` env var fallback

All values validated to start with `mcp__` prefix (can't widen non-MCP allowlist).

Passed to containers via env vars: `NANOCLAW_ALLOWED_MCP_TOOLS`, `NANOCLAW_MCP_TOOL_INVENTORY`, `MCP_PROXY_TOKEN`, `MCP_PROXY_URL`.

Claude provider receives these at construction time (`ClaudeProviderOptions`) — provider-internal, not on the generic `QueryInput` interface.

### Trigger Routing (`src/router.ts`)

`pickAgents()` replaces the upstream v2 stub:
- Parses `trigger_rules` JSON from `messaging_group_agents` rows
- Matches `{ pattern, requiresTrigger }` against message text
- Supports multi-agent fan-out: `@agentA @agentB` routes to both
- Regex compiled once and cached (`triggerRegexCache`)
- Parallel container wakes via `Promise.all()`

### Coworker Creation (`src/delivery.ts` — `create_agent` handler)

Extended from upstream v2's `create_agent`:
- New fields: `coworkerType`, `allowedMcpTools`, `instructionOverlay`
- Creates `messaging_group_agents` row scoped to the conversation that triggered creation (not all admin channels)
- Creates channel `agent_destinations` so coworker can reply
- Calls `refreshAdapterConversations()` so adapters learn about new trigger rules without restart
- `allowed_mcp_tools` validated to `mcp__` prefix only
- Instruction overlay prepended to `.instructions.md` (default: `thorough-analyst`)
- Instructions always written to `.instructions.md` (CLAUDE.md is system-composed)

### CLAUDE.md Ownership Model

```
.instructions.md = user-owned (written at creation, editable via dashboard)
CLAUDE.md        = system-owned (regenerated every wake from templates + .instructions.md)
```

Every non-admin coworker gets CLAUDE.md recomposed on every container wake:
- Base template + sections + project overlays + role templates (if typed) + .instructions.md
- Template updates propagate to all coworkers automatically
- Existing coworkers with manual CLAUDE.md auto-migrate to .instructions.md on first wake
- Dashboard edits `.instructions.md`, shows composed CLAUDE.md as read-only preview

### Instruction Overlays (`groups/templates/instructions/`)

Pre-built communication style templates prepended to `.instructions.md` at creation:

| Overlay | Style |
|---------|-------|
| `thorough-analyst` (default) | Detailed analysis with root cause, evidence, impact |
| `terse-reporter` | Concise bullet points, one sentence per finding |
| `code-reviewer` | Prioritized code quality (security > correctness > perf) |
| `ci-focused` | CI failure investigation: bisect, reproduce, minimal fix |

Resolution:
1. `instructionOverlay` field from `create_agent` (or default `thorough-analyst`)
2. Read `groups/templates/instructions/{name}.md`
3. Prepend to user-provided instructions in `.instructions.md`

### Shared Learnings (`container/agent-runner/src/mcp-tools/learnings.ts`)

- `append_learning` MCP tool writes system action to `outbound.db`
- Host handler in `delivery.ts` writes to `groups/global/learnings/`, rebuilds `INDEX.md`
- All agents read via `/workspace/global` mount

### Canonical Destination Naming (`src/db/agent-destinations.ts`)

`allocateDestinationName(agentGroupId, preferredName)`:
- Normalizes preferred name (lowercase, replace non-alnum with hyphens)
- Auto-suffixes on collision within the agent's namespace
- Used by both `setup/register.ts` and `delivery.ts` create_agent

### Peer Agent Wiring (`wire_agents` MCP tool)

By default, `create_agent` only creates parent↔child links. Sibling agents (A and B, both children of Main) cannot talk directly. The `wire_agents` tool fixes this:

```
Main calls: wire_agents(agent_a: "worker-a", agent_b: "worker-b")

Before:  A → Main → B  (everything routes through orchestrator)
After:   A → B directly (both have each other in their destination map)
```

How it works:
- Admin-only (same gate as `create_agent`)
- Resolves both names from admin's destination map
- Validates: both are agent destinations, different targets
- Creates bidirectional `agent_destinations` rows
- Idempotent: reuses existing links, reports reused aliases
- Refreshes all active sessions for both agents immediately

This is a separate commit on v2_main (`abca72e`) — can be reverted if upstream v2 adds native peer wiring.

**Communication patterns after wiring:**

```
A: <message to="worker-b">Run tests on these files</message>   → delivered to B
B: <message to="worker-a">Tests passed, 2 failures</message>   → delivered to A
```

The host delivery path (`src/delivery.ts:317`) already supports agent-to-agent sends — `wire_agents` just adds the destination rows that authorize them.

### Base Agent Prompts

`groups/global/CLAUDE.md` and `groups/main/CLAUDE.md` include:
- Agent Teams `shutdown_request` + `team-lead` protocol
- Sub-agent communication guidelines

## What skill/v2_dashboard Adds

### Dashboard Server (`dashboard/server.ts`)

Standalone HTTP server (2638 lines) — real-time observability:
- 4-tab UI: Pixel Office, Coworkers, Timeline, Admin
- Receives hook events via `POST /api/hook-event`
- Stores in `hook_events` table (migration 007)
- SSE stream for real-time browser updates
- REST API for coworker CRUD, file browsing, session listing, debug info

All DB queries adapted from v1's `registered_groups`/`messages` tables to v2's `agent_groups`/`sessions`/per-session DBs.

### Dashboard as Chat Channel

The dashboard routes chat through a localhost ingress bridge so it works even when the dashboard server runs as a standalone process:

```
Browser → POST /api/chat/send (dashboard server, port 3737)
  → POST http://127.0.0.1:3738/api/dashboard/inbound (host ingress bridge)
    → routeInbound()     ← same path as Discord/Slack/Telegram
      → router → session → inbound.db → container → outbound.db
        → deliver() → returns message ID
          → browser polls /api/messages → sees response
```

The ingress bridge (`src/dashboard-ingress.ts`) runs inside the host process and calls `routeInbound()` directly. Session creation, trigger matching, typing indicators — all work because the dashboard goes through the standard router.

### Authentication (DASHBOARD_SECRET)

Cookie-based auth that works with EventSource/SSE:
- `GET /api/auth/status` — check if auth required + session state
- `POST /api/auth/session` — submit secret, get HMAC'd session cookie
- Frontend wraps `window.fetch` to auto-prompt for secret when needed
- Cookies travel with all requests including EventSource (unlike bearer headers)

### Config Loading

`DASHBOARD_PORT`, `DASHBOARD_SECRET`, and `DASHBOARD_INGRESS_PORT` all loaded from `.env` via `readEnvFile()` in `src/config.ts`. Container-runner uses config constants (not raw `process.env`).

### Hook Event Pipeline

Container-runner injects HTTP hooks into `settings.json` when `DASHBOARD_PORT` is set (all 25 SDK hook event types). Dashboard server normalizes both Claude SDK native format and legacy bash-script format.

### Branch Boundaries

Dashboard branch touches these core files:
- `src/channels/dashboard.ts` (new — channel adapter, enabled in barrel)
- `src/channels/index.ts` (enables dashboard import)
- `src/dashboard-ingress.ts` (new — localhost chat bridge for cross-process routing)
- `src/container-runner.ts` (config-driven hook injection + DASHBOARD_URL)
- `src/config.ts` (DASHBOARD_PORT, DASHBOARD_SECRET, DASHBOARD_INGRESS_PORT from .env)
- `src/index.ts` (starts ingress bridge in host process)
- `src/db/migrations/007-hook-events.ts` (new — hook_events table)
- `vitest.config.ts`, `package.json` (test/script config)

## What skill/v2_slang Adds

Pure content — no TypeScript code changes:

- `container/mcp-servers/slang-mcp/` — Python MCP server (GitHub, Discord, Slack, GitLab integrations)
- `container/skills/slang-*/` — 7 container skill directories (build, explore, fix, github, maintain, templates)
- `groups/coworker-types.json` — 11 coworker type definitions with templates, focus files, allowed MCP tools
- `groups/templates/projects/slang/` — project overlays (coworker-base, global-overlay, main-overlay)
- `.claude/skills/onboard-coworker/` — interactive wizard for creating new coworker roles

Does NOT modify `groups/main/CLAUDE.md` or `groups/global/CLAUDE.md` — uses overlays only.

## Architecture Guardrails

Each branch has regression tests that prevent drift:

### `src/architecture-alignment.test.ts` (v2_main)
- Manifests reference existing section files
- No `dashboard-formatting` in manifests (renamed to `web-formatting`)
- Skill install stubs point to `skill/v2_dashboard` and `skill/v2_slang`
- add-slang uses overlay composition, not direct CLAUDE.md patching

### `src/dashboard-architecture.test.ts` (skill/v2_dashboard)
- Same manifest checks
- Dashboard channel import IS enabled (not commented out)
- Skill refs correct

### `src/slang-architecture.test.ts` (skill/v2_slang)
- Manifest sections exist
- add-slang doesn't patch base CLAUDE.md
- All coworker-type templates point to real files

## How It All Connects

```
User types "@slang-compiler why does generic inference fail?" in Slack
    │
    ▼
Chat SDK Slack Adapter
    → onInbound("C123...", null, message)
    │
    ▼
Router: pickAgents()
    → trigger_rules: { pattern: "@slang-compiler\\b", requiresTrigger: true }
    → matches! resolves session for slang-compiler agent group
    │
    ▼
Session Manager: writeSessionMessage(inbound.db)
    → wakeContainer()
    │
    ▼
Container Runner: spawnContainer()
    → composeClaudeMdIfNeeded() [skips — already composed at creation]
    → resolveAllowedMcpTools() → ["mcp__slang-mcp__github_get_issue", ...]
    → registerContainerToken(folder, allowedTools)
    → buildContainerArgs() → injects MCP_PROXY_TOKEN, MCP_PROXY_URL
    │
    ▼
Container: agent-runner poll loop
    → reads inbound.db
    → connects to slang-mcp via auth proxy (bearer token)
    → Claude SDK processes with slang-compiler templates + allowed tools
    → writes response to outbound.db
    │
    ▼
Host: delivery poll (1s)
    → reads outbound.db
    → hasDestination() ACL check → "slack-general" destination exists
    → adapter.deliver() → Slack API → user sees response
    │
    ▼
Container exit: revokeContainerToken()
```

## Template Inheritance (`extends`)

Coworker types can extend other types — templates, focusFiles, and allowedMcpTools merge from all ancestors:

```
compiler-base
    └── slang-build
            ├── slang-ir         (inherits slang-build + adds IR template)
            ├── slang-frontend   (inherits slang-build + adds parser template)
            └── slang-testing    (inherits slang-build + adds test template)
```

`resolveTypeChain()` in `src/claude-composer.ts` walks the chain. `resolveTypeFields()` merges all fields. Both composition and MCP tool resolution use the chain.

## Instruction Overlay Templates

Reusable communication styles in `groups/templates/instructions/`:

| Overlay | Style |
|---------|-------|
| `thorough-analyst` | Detailed analysis with evidence and examples |
| `terse-reporter` | Bullet points, no preamble |
| `code-reviewer` | Security → correctness → performance → maintainability |
| `ci-focused` | CI log → bisect → reproduce → minimal fix |

Selected when creating a coworker (dashboard UI dropdown or `/onboard-coworker` prompt). Composed `.instructions.md` = overlay + custom instructions. Template name preserved in `.instruction-meta.json` for export portability.

## YAML Export/Import

Agents are portable via YAML bundles (v3 format):

```yaml
version: 3
agent:
  name: "Slang IR Analyst"
  folder: "slang-ir"
  coworkerType: "slang-ir"
requires:
  coworkerTypes: ["slang-ir", "slang-build"]
  projectOverlays: ["slang"]
instructions: |
  Focus on IR generation, optimization passes.
instructionTemplate: "thorough-analyst"
trigger: "@slang-ir\\b"
destinations:
  - name: "parent"
    type: "agent"
    targetFolder: "main"
files:
  memory/latest-report.md: "..."
```

**Export** (`GET /api/coworkers/:folder/export`):
- Agent metadata, `.instructions.md`, destinations, trigger, files
- Compatibility metadata: required types (full extends chain) + project overlays
- Warns on skipped large/binary files

**Import** (`POST /api/coworkers/import`):
- Accepts YAML or JSON (backward compatible)
- Transactional: stage files → commit DB → copy (rollback on any failure)
- Validates compatibility requirements, warns on missing types/overlays
- Safe destination collision: same target = reuse, different = rename with suffix
- Rejects hidden path components
- Returns resolved destination audit trail + warnings

Sessions are intentionally out of scope for this iteration.

## Onboarding Coworkers

### `/onboard-coworker` skill (v2_main)

Generic skill that scans `coworkers/*.yaml` for pre-packaged agent definitions:

```
Phase 0: Discovery
  → scan coworkers/*.yaml + coworker-types.json + groups/
  → list available vs already-created

Phase 1: Create from YAML
  → check requires, select instruction overlay
  → create_agent for each selected
  → optionally wire_agents for peer communication

Phase 2: Create custom
  → name, type, instructions → create_agent
```

### `/setup` skill integration

Step 9 (optional): if `coworkers/` directory exists after a skill branch merge, offers to run `/onboard-coworker`.

### Pre-packaged YAML files

Each skill branch brings its own coworker definitions:

```
skill/v2_slang:
  coworkers/
    slang-ir.yaml              ← contributors push these
    slang-issue-solver.yaml    ← when production-ready
    slang-ci.yaml
```

After `/add-slang` merges the branch, `/onboard-coworker` discovers the YAMLs automatically.

## Contributor Path

To add a new coworker type (e.g., BugSolver):

```
1. Create role template:
   container/skills/slang-templates/templates/slang-issue-solver.yaml

2. (Optional) Create MCP server:
   container/mcp-servers/slang-pr-knowledge/
     pyproject.toml    ← auto-detected by MCP registry
     .env-vars         ← required env var names
     src/server.py

3. Add type to registry:
   groups/coworker-types.json
   {
     "slang-issue-solver": {
       "extends": "slang-build",
       "template": "container/skills/slang-templates/templates/slang-issue-solver.yaml",
       "allowedMcpTools": ["mcp__slang-pr-knowledge__search_prs", ...]
     }
   }

4. Create coworker YAML:
   coworkers/slang-issue-solver.yaml

5. PR to skill/v2_slang → reviewable, mergeable
```

After merge, anyone runs `/onboard-coworker` → sees "Slang Issue Solver" → creates it.

## File Index

### v2_main (coworker infrastructure)
| File | Purpose |
|------|---------|
| `src/claude-composer.ts` | Template composition with `extends` chain support |
| `src/mcp-registry.ts` | MCP server lifecycle management |
| `src/mcp-auth-proxy.ts` | Per-container token auth + tool ACL |
| `src/container-runner.ts` | Manifest composition, tool resolution, token management |
| `src/router.ts` | Trigger matching with fan-out |
| `src/delivery.ts` | Scoped coworker creation, wire_agents, learnings handler |
| `src/db/migrations/006-coworker-fields.ts` | coworker_type + allowed_mcp_tools |
| `src/db/agent-destinations.ts` | allocateDestinationName(), getDestinationByTarget() |
| `container/agent-runner/src/mcp-tools/learnings.ts` | append_learning MCP tool |
| `container/agent-runner/src/mcp-tools/agents.ts` | create_agent + wire_agents |
| `container/agent-runner/src/providers/claude.ts` | Provider-internal tool filtering |
| `groups/templates/` | Manifest YAML + section templates |
| `groups/templates/base/` | Upstream-anchored base prompt sources (main.yaml, global.yaml) |
| `groups/templates/instructions/` | Reusable instruction overlay templates |
| `scripts/rebuild-claude-md.ts` | Regenerate CLAUDE.md from manifests |
| `.claude/skills/onboard-coworker/` | Generic YAML-scanning coworker onboarding |
| `.claude/skills/setup/` | Setup skill with Step 9 coworker onboarding |

### skill/v2_dashboard
| File | Purpose |
|------|---------|
| `dashboard/server.ts` | HTTP server (REST + SSE + YAML export/import + cookie auth) |
| `dashboard/public/` | Pixel art UI (app.js with auth + instruction overlays + YAML) |
| `src/channels/dashboard.ts` | Channel adapter (enabled in barrel) |
| `src/dashboard-ingress.ts` | Localhost chat bridge for cross-process routing |
| `src/config.ts` | DASHBOARD_PORT, DASHBOARD_SECRET, DASHBOARD_INGRESS_PORT from .env |
| `src/index.ts` | Starts ingress bridge in host process |
| `src/container-runner.ts` | Config-driven hook injection + DASHBOARD_URL |
| `src/db/migrations/007-hook-events.ts` | hook_events table |

### skill/v2_slang
| File | Purpose |
|------|---------|
| `container/mcp-servers/slang-mcp/` | Python MCP server |
| `container/skills/slang-*/` | Container skills (7 directories) |
| `groups/coworker-types.json` | 11 type definitions with `extends` inheritance |
| `groups/templates/projects/slang/` | Project overlays (v2 model) |
| `coworkers/` | Pre-packaged YAML definitions (when contributors push them) |
