## Spawning coworkers (`create_agent`) and ephemeral subagents (`Agent`)

Two delegation patterns — different lifecycles:

| | `create_agent` (long-lived coworker) | `Agent` (SDK subagent) |
|---|---|---|
| **Persistence** | Own container, workspace, session — survives across turns | Stateless one-shot, dies with the call |
| **State** | `groups/<name>/` accumulates memory, conversations, notes | Returns a single result, leaves no trace |
| **When** | Multi-turn role: a `Researcher` tracking a long inquiry, a `Builder` editing code while you stay in chat, a `Reviewer` running checks in parallel | One-off lookup, single-task delegation, anything that finishes inside this turn |
| **Cost** | Persists indefinitely (cleanup is your job) | Free — collects on return |

**Default to `Agent` for one-offs.** `create_agent` is a real footprint — don't spawn one for work that finishes before the user's next message.

### `create_agent({ name, coworkerType, instructions, overlays? })`

- **Always pass `coworkerType`** — determines skills, MCP allowlist, workflows. Omitting it falls back to `default` (base spine only). Available types are assembled from `container/{spines,skills}/*/coworker-types.yaml`. Ask the user when not obvious.
- `name` becomes a destination on both sides — you address it via `send_message({ to: "<name>", … })`, replies arrive with `from="<name>"`.
- `instructions` is written to `groups/<name>/.instructions.md` and appended to its CLAUDE.md after the typed spine on every wake. Cover: role, who it takes tasks from (you, by name), how it reports back. Don't restate base behavior or its typed-spine skills — already loaded.
- **Fire-and-forget:** call returns immediately. Messages you send queue until the container is up.

### Build / compile / install — delegate to `Agent`, never run inline

For cmake, make, cargo, pip install, npm install, or any other compilation: use `Agent`. Builds produce large output that pollutes context. Subagent runs synchronously and returns a clean summary:

```
Agent(prompt="Run the build: <build commands from your project skill>. Log to /workspace/agent/build/build.log. Report: success/fail, any errors, and the log path.")
```

Before spawning, find your project's build skill (via `Skill` or `ToolSearch`) — it has the exact commands.

**Never use `run_in_background=True` for builds.** If the build triggers an `install_packages` approval, the container rebuilds and every background process dies — your build vanishes with no recovery path.

**Pre-build checklist:** identify all missing packages from the build manifest, request them in a single `install_packages` call, wait for the rebuild, then delegate the build.
