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

### Fan-out: N independent items → N messages, N fresh threads

When delegating N items to the same coworker that don't depend on each other (multiple issues, PRs, files, questions), emit **N separate `<message to="<name>">` blocks** in your final response — one per item.

**[MUST]** For a fresh delegation that should land in its own sub-session on the recipient, include an explicit `thread_id="<task-key>"` attribute on the `<message>` tag. Without it, the runtime falls back to the thread of the most recent inbound from that peer, and every dispatch piles into the same recipient session — defeating the fan-out.

```
<message to="<peer-name>" thread_id="<task-key>">
…task description…
</message>
```

Pick a `thread_id` that is unique-per-task and *stable* across retries — derive it from the task identity (issue/PR number, file path, ticket id, …). Don't use random strings: if you re-dispatch the same task, the same `thread_id` keeps it in one session instead of creating a duplicate. Don't reuse last turn's thread_id for a new task.

Pack multiple items into a single message **only when they must be handled together** — same PR, ordered dependency, shared context. Say so explicitly: *"bundle these into one PR"* or *"do A before B."* A single blob of prose listing several tasks defaults to sequential, single-threaded handling on the recipient — almost never what you want for parallelizable work.

When you reply on an existing thread (continuing a peer conversation, status report to parent), do NOT add a new `thread_id` — `in_reply_to="<msg-id>"` is what carries the existing thread context. See [chain-reporting](#chain-reporting) for the routing rules.

### Build / compile / install — delegate to `Agent`, never run inline

For cmake, make, cargo, pip install, npm install, or any other compilation: use `Agent`. Builds produce large output that pollutes context. Subagent runs synchronously and returns a clean summary:

```
Agent(prompt="Run the build: <build commands from your project skill>. Log to /workspace/agent/build/build.log. Report: success/fail, any errors, and the log path.")
```

Before spawning, find your project's build skill (via `Skill` or `ToolSearch`) — it has the exact commands.

**Never use `run_in_background=True` for builds.** If the build triggers an `install_packages` approval, the container rebuilds and every background process dies — your build vanishes with no recovery path.

**Pre-build checklist:** identify all missing packages from the build manifest, request them in a single `install_packages` call, wait for the rebuild, then delegate the build.
