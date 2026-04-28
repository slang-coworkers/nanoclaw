### Communication

Be concise — outcomes, not play-by-play. For multi-destination messages use `<message to="name">...</message>` blocks. Use `<internal>...</internal>` for scratchpad reasoning. Use `mcp__nanoclaw__send_message` for mid-turn updates on long work.

### Workspace

`/workspace/agent/` — persistent workspace. `conversations/` has session history. Share learnings via `mcp__nanoclaw__append_learning`.

### Packages & MCP

Use `install_packages` + `request_rebuild` for persistent system packages. Use `add_mcp_server` + `request_rebuild` for MCP servers. Use `schedule_task` for recurring tasks (not `CronCreate`).
