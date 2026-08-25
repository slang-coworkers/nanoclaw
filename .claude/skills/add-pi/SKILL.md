---
name: add-pi
description: Use pi (the pi.dev terminal coding harness) as the full agent provider — planning, tool orchestration, session resume — in place of the Claude Agent SDK. Drives `pi --mode rpc` as a subprocess over JSONL. MCP tools via the pi-mcp-adapter extension; auth via the OneCLI proxy. Per-group via agent_provider. Distinct from using an LLM as an MCP tool (where Claude remains the planner).
---

# pi agent provider

NanoClaw runs agents in a long-lived **poll loop** inside the container. The backend is selected with **`AGENT_PROVIDER`** (`claude` | `opencode` | `codex` | `pi` | `mock`).

The pi provider runs **`pi --mode rpc`** as a child process and speaks strict JSONL over stdio — native session resume, streaming events, and (via an adapter) MCP tools. It mirrors the Codex provider's subprocess model.

## Architecture

- **Transport** — `container/agent-runner/src/providers/pi-rpc.ts`: spawn `pi --mode rpc --session-dir <dir>`, JSONL framing, response correlation by `id`, `startOrResumePiSession` (`switch_session` → `get_state.sessionFile`), model/thinking application.
- **Provider** — `container/agent-runner/src/providers/pi.ts`: `PiProvider`, one rpc subprocess per query, per-turn event pump (`message_end.message` → result, `agent_settled` → done).
- **MCP** — pi has no native MCP. `mcp-to-pi.ts` writes NanoClaw's MCP servers to `<pi-agent-dir>/mcp.json` (stdio + HTTP); the **`pi-mcp-adapter`** extension connects to them and exposes their tools. The adapter is installed into a fixed flat `node_modules` at image build (`/opt/pi-ext`, exact pin, `--ignore-scripts`) and loaded by **absolute path** via settings `extensions` (`PI_MCP_ADAPTER_ENTRY`) — no `pi install`, no runtime npm fetch.
- **System prompt** — pi doesn't read CLAUDE.md and RPC has no system-prompt field, so `pi-extensions/nanoclaw-context.ts` injects the composed instructions via the `before_agent_start` hook.
- **Host config** — `src/providers/pi.ts`: mounts a per-session `~/.pi` (so the session transcript survives restarts) and sets stub API keys. **pi does not honor `ANTHROPIC_BASE_URL`** — it routes through the OneCLI `HTTPS_PROXY` exactly like the claude provider; the stub key just selects the provider.

## Install

### Pre-flight

If all of the following are already present, skip to **Configuration**:

- `container/agent-runner/src/providers/pi.ts`, `pi-rpc.ts`, `mcp-to-pi.ts`, `pi-extensions/nanoclaw-context.ts`
- `src/providers/pi.ts`
- `import './pi.js';` in **both** `container/agent-runner/src/providers/index.ts` and `src/providers/index.ts`
- `@earendil-works/pi-coding-agent` entry in `container/cli-tools.json` (pinned to a version matured past the 3-day release-age gate), and the `/opt/pi-ext` adapter install (+ `PI_MCP_ADAPTER_ENTRY`) in `container/Dockerfile`
- `PI_MODEL` / `PI_PROVIDER` / `PI_THINKING_LEVEL` in the container-runner env passthrough list

### Build

```bash
pnpm exec tsc --noEmit                                          # host typecheck
pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit  # container typecheck
( cd container/agent-runner && bun test )                       # container tests
./container/build.sh                                            # agent image (installs pi + pi-mcp-adapter)
```

The `pi` CLI is installed from `container/cli-tools.json` (pnpm-global, release-age-quarantined — pin a version ≥3 days old or the build fails the gate). The `pi-mcp-adapter` extension is installed into `/opt/pi-ext/node_modules` (npm, exact pin, `--ignore-scripts`) and `PI_MCP_ADAPTER_ENTRY` is baked so pi loads it by absolute path. If Docker Desktop requires an org sign-in, sign in first (`! docker login`) or build on a box that can. If the published package ships a compiled entry rather than `index.ts`, update `PI_MCP_ADAPTER_ENTRY` to match.

## Configuration

### Auth (OneCLI)

pi reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` to pick a provider, then sends requests to the real API host **through the OneCLI HTTPS_PROXY**, which injects the vaulted credential — same path as the claude provider. So no real key goes in `.env`; the host sets a stub.

Because auto-created agents start in **`selective`** secret mode, assign the provider credential to the pi agent (see the OneCLI gotcha in `CLAUDE.md`):

```bash
onecli agents list
onecli agents set-secret-mode --id <agent-id> --mode all   # or set-secrets for a specific key
```

For an Anthropic-backed pi group this is the same `ANTHROPIC_API_KEY` vault secret the claude groups use; for an OpenAI-backed one it's the OpenAI key (like codex).

### Model / provider / thinking

Set via host env (forwarded by the container-runner passthrough), defaulting to the `anthropic` provider and pi's default model:

```env
PI_PROVIDER=anthropic          # or openai
PI_MODEL=claude-opus-4-5       # optional; pi default otherwise
PI_THINKING_LEVEL=high         # off|minimal|low|medium|high|xhigh|max
```

### Per group / per session

Point a group at pi:

```bash
ncl groups config update --id <group-id> --provider pi
ncl groups restart --id <group-id>
```

The DB columns `agent_groups.agent_provider` / `sessions.agent_provider` (session overrides group) drive host-side resolution; `resolveProviderName` falls back session → group → `container_configs.provider` → `'claude'`.

### Existing groups (agent-runner-src staleness)

`container-runner.ts` bind-mounts each group's **own writable copy** of the runner source (`data/v2-sessions/<group-id>/agent-runner-src`), copied once at group creation. Pre-existing groups therefore lack the pi provider files and will fail with **`Unknown provider: pi`** when switched. Refresh their copy (adds only the new pi files without clobbering local edits) and restart:

```bash
pnpm run check:runner-staleness            # show which groups are stale
pnpm run check:runner-staleness -- --refresh
ncl groups restart --id <group-id>
```

New groups created after this change get the pi files automatically.

## Operational notes

- **Spawn-per-query:** the rpc subprocess is spawned fresh per query invocation, matching the OpenCode/Codex pattern. No long-lived daemon.
- **Session resume:** the resume token is the pi session **file path** (`get_state.data.sessionFile`), persisted per-provider in `outbound.db` (`continuation:pi`). The transcript lives under the per-session `~/.pi` mount, so resume survives container restarts.
- **Tools run un-gated:** pi's RPC mode executes tools automatically (no approval prompt, no built-in sandbox) — the container is the security boundary, same posture as codex `danger-full-access`.
- **No cost tracking:** the poll-loop cost cap is claude-only, so pi (like codex/opencode) accrues none.
