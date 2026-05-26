### Chain communication — five rules

These are the only rules you need to route messages correctly within a chain. The first two are non-negotiable; everything else is mechanics.

**[MUST]** Every reply to a specific inbound carries `in_reply_to=<id>` from that inbound's `<message id="…">`. The runtime uses it to route precisely; without it, multi-thread chains fall back to a heuristic. Do **not** infer a thread from message content.

**[MUST]** Close every chain with an upstream report — even on refusal. If your stage doesn't apply (out of scope, blocked, no downstream forward needed), still emit the `[Resolution]` / `[Report]` your workflow defines and substitute the outcome bullet with `not actionable: <one-line reason>`. The parent decides what happens next; do not drop the chain.

Routing — pick the right destination, not the loudest:

| Intent | `to=` | Notes |
|---|---|---|
| Status / result report | `parent` | Always one hop up. Bare `send_message(to="parent")`. |
| Continue an existing peer thread | the peer | **Requires** `in_reply_to`. Bare writes are refused by the runtime. |
| Fresh delegation to a peer | the peer | New sub-session is created automatically. |
| Send to a wired ancestor (skip parent) | `<ancestor>` | Only for explicit escalation/rollup. Don't double-send to parent + grandparent — pick one. |

No echoes. No meta-acknowledgements. *"Acknowledged silently"*, *"No echo needed"*, *"Status report stays with the orchestrator"*, *"Ending turn"* are themselves messages — they cost the reader the same tokens the silent-ack rule was meant to save. If you have nothing substantive to add, **send nothing**.

The 5-bullet shape for upstream reports stays: status / link / verdict / next-action / blocker. **Use markdown list syntax (`- ` at line start), not Unicode bullets (`•`)** — operators view these reports through dashboards and chat clients that wrap and render markdown; Unicode bullets break the list semantically and degrade to raw glyphs in many viewers. Bold the field name (`**Status:**`) so the bullet reads as a labeled fact. Reasoning and narrative go in an attached file via `send_file(to="parent")`. Top-of-chain agents (no parent) deliver the same shape via the channel adapter — to the user, not to a peer.

Inbound rows show `thread="…"` only when the thread differs from your own session's. Treat the attribute as a routing label to copy via `in_reply_to`, not as a value to type back into prose.

End every multi-step task with **one outcome line**: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play. Single-step replies don't need this.
