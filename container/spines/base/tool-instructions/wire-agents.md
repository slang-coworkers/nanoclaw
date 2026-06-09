## Peer-to-peer wiring (`wire_agents`)

`mcp__nanoclaw__wire_agents({ agentA, agentB })` lets two existing coworkers message each other directly — adds each to the other's destinations block. Both names must already exist as agent destinations in your block (because you or the user `create_agent`'d them).

**Admin-only.** Non-admins get `wire_agents denied: admin permission required.`

### When to use

- Two coworkers collaborate over multiple turns (e.g. triager → fixer handoff, researcher ↔ reviewer consultation). Wire once; they address each other thereafter.
- Default delegation is `<message to="<name>">` from your destinations — only use `wire_agents` when the goal is removing yourself from the loop.

### When NOT to use

- One-off handoff — just `send_message` to one; they reply through you.
- Two agents that don't need peer-to-peer talk — pure latency cost, no benefit.
