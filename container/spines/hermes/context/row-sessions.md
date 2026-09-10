### One live session per role per row

A role's session on a row is keyed by who opened it: an a2a send from you to hermes-builder on
`hermes-<ROW>` lands in a **different** session than the one the architect's hand-off created, so an
unpinned nudge, question or re-dispatch opens a second builder session and two containers can work
one task. Before you message any role about an in-flight row:

1. Find its existing session on that thread: `ncl sessions list --json`, filter the role's agent
   group and `thread_id == hermes-<ROW>`; prefer the one whose container is running, else the most
   recently active one.
2. Send with `send_message(to=<role>, thread_id="hermes-<ROW>", target_session_id=<that id>, text=…)`.
   Autopilot `nudge` actions already carry `target_session_id`; pass it through unchanged.
3. Never let a nudge open a second session for the same row. If two exist, address the one created
   by the chain hand-off (its peer is the upstream role) and say so in the message; leave the other idle.
