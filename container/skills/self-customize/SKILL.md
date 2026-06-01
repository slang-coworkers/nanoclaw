---
name: self-customize
license: MIT
description: Customize your own agent — add capabilities, install packages, add MCP servers, edit code or CLAUDE.md. Delegate non-trivial code changes to a builder agent via create_agent.
---

# Self-Customization

Change type → workflow:

| Change                               | Workflow                                                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.local.md` or workspace files | Edit directly, no approval. `/workspace/agent/` persists. Composed `CLAUDE.md` is read-only, regenerated every spawn — write to `CLAUDE.local.md` instead. |
| System (apt) or global npm package   | `install_packages`. Admin approval → image rebuild + restart, automatic.                                                                                   |
| MCP server                           | `add_mcp_server`. Admin approval → restart with server wired (no rebuild — bun runs TS).                                                                   |
| Your source code or Dockerfile       | Delegate to a builder via `create_agent` (below).                                                                                                          |
| A new specialist capability          | `create_agent` for a dedicated agent.                                                                                                                      |

## Code changes via builder agent

For source-file edits, do not edit directly — delegate, to keep a reviewable boundary.

1. Describe the change concretely (files, behavior, acceptance criteria).
2. `create_agent({ name: "Builder", instructions: "<builder prompt>" })`.
3. `send_to_agent({ agentGroupId, text: "<task with specific files and changes>" })`.
4. Source edits in `/app/src` are picked up on next container start (no rebuild); `install_packages` rebuilds. Notify the orchestrator (below); surface to the user only on failures/blockers.

### Builder Agent Instructions (use as CLAUDE.md when creating)

```
You are a builder agent. Make precise, minimal code changes to NanoClaw source files on request.

- Minimal scope. Only what was requested; no refactors or extra features.
- Diff limits per task: reject >200 new or >150 modified lines; push back to split.
- Read the target file fully before editing.
- Run relevant tests after the change.
- Report via send_to_agent: (a) files changed, (b) summary, (c) follow-up (rebuild, tests, migrations).
- No silent failures — if you can't finish, say why; don't ship unflagged partial work.
- Never edit outside scope; never commit, push, or touch secrets/credentials/.env.
- If a change would break existing tests, stop and report.
```

Limits are per builder task, not per session — a 500-line feature is ~4 sequential ~125-line tasks.

## Examples

- **MCP tool** ("read RSS feeds"): check [mcp.so](https://mcp.so) for an existing server → if found, `add_mcp_server({ name: "rss", command: "npx", args: ["some-rss-mcp"] })` → approve → restart. Else delegate: `send_to_agent({ agentGroupId, text: "Add MCP tool 'read_rss' to container/agent-runner/src/mcp-tools/, register in index.ts, <200 new lines." })`.
- **System tool** ("transcribe audio"): `which ffmpeg` → `install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], reason: "Audio transcription" })` → on approve, image rebuilds and restarts → test.

## When NOT to self-customize

- One-off task → do it in your workspace.
- Ambiguous request → ask the user first.
- Unsure it works → prototype in workspace (`pnpm install` in `/workspace/agent/`), then promote.

## Scope limits

Limited to your own container and workspace. Do NOT:

- Modify another group's `CLAUDE.local.md` or workspace files.
- Push to host NanoClaw source (separate PR process).
- Expand your allowed-tools list without the corresponding reviewed source change.

## Infinite-loop guard

After a customization that triggers a restart, the container relaunches fresh. Do not re-issue the same customization on the first turn after restart — verify the capability is available first. Sequence: request → approval → rebuild → verify → done.

## Notify the orchestrator

After any structural change (package, MCP server, source via builder), send a `mcp__nanoclaw__send_message` summary to the orchestrator group: (a) what changed, (b) how to verify, (c) caveats.
