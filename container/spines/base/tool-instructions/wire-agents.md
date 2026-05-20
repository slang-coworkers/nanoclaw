## Peer-to-peer wiring (`wire_agents`)

`mcp__nanoclaw__wire_agents({ agentA, agentB })` enables two existing coworkers to message each other directly — adds them to each other's destinations block.

**Admin-only.** Non-admin coworkers calling this get `wire_agents denied: admin permission required.`

### When to use

- Two coworkers will collaborate over multiple turns (e.g. `triager` → `fixer` handoff, `researcher` ↔ `reviewer` consultation). Wire them once; they address each other directly thereafter.
- Default delegation is via `<message to="<name>">` from your destinations — only reach for `wire_agents` when removing yourself from the loop is the goal.

### When NOT to use

- One-off task handoff — just `send_message` to one of them; they reply through you.
- Wiring two agents that don't need to talk peer-to-peer — pure latency cost, no benefit.

Both names must already exist as agent destinations in your block (typically because you `create_agent`'d them or the user did).
