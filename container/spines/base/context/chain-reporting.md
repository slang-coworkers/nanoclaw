### Reporting upstream

When you produce a status update or end-of-work report destined for your parent (the agent that handed work to you), use `send_message(to="parent")` with a **tight 5-bullet executive summary**.

- Five bullets, no more. Your parent will compile their own 5 bullets upstream — a wall of text means they re-read your whole report to extract the signal.
- Full narrative, multi-paragraph context, code snippets, etc. → attach as a markdown file via `send_file(to="parent")`. The bullets reference the attachment.
- Concrete signals (status, links, decision verdicts, next-action) belong in the bullets so they're scannable. Reasoning belongs in the attachment.

Your specific workflow's "Report" step gives the exact 5-bullet template for your output shape. If you have nothing substantive to report (e.g. claimed-and-deferred via an active-work sentinel, or a polite-ack that adds no information), a 1-line `send_message` is enough — or end the turn silently. Bullets are for actual work results.

If you have no parent (e.g. you are the admin/orchestrator, or a top-level coworker the user talks to directly), the protocol still applies to messages you produce that summarize work — just deliver them via the channel adapter rather than `to="parent"`. The shape (≤5 scannable bullets, narrative as attachment) is the same.

### Peer and ancestor messaging

Default communication goes **one hop upward** to your direct parent. Not every reply goes to the root.

**IMPORTANT:** When responding to an inbound message, pass `in_reply_to=<id>` from the inbound `<message id="…">`. This copies the right thread automatically and stamps the routing link. Don't infer thread identity from message content — that's how cross-thread mis-tagging happens.

**IMPORTANT:** Don't echo a coworker their own conclusion. Status reports go up, not sideways. If a child reported to you, your parent hears about it from you — the child doesn't need an "acknowledged" reply back.

Routing rules:
- **Bare `send_message(to="parent")`** → direct parent. Right for status/result reports.
- **`send_message(to="<ancestor>")`** (when wired) → delivered to that ancestor's existing session. Don't double-send to parent + grandparent; pick one.
- **`send_message(to="<peer>")`** with no shared history → fresh delegation, peer gets a new sub-session.
- **Continuing a peer's existing thread** → requires `in_reply_to`. Bare writes to a peer-owned thread are refused by the runtime.

Inbound rows show `thread="…"` only when the thread differs from your own session's. Treat that attribute as a routing label, not as a value to type back into prose.

### Multi-chain orchestration

When you're running parallel chains, status routing changes shape:

- **Per-chain decision or follow-up** → reply on that chain's thread with `in_reply_to`. Only that chain acts on it.
- **Cross-chain rollup** → your own conversation. The user is the only consumer of "here's everything across all chains".
- **Acknowledgement** → end the turn silently. Adds no signal, costs every reader.

**IMPORTANT:** Never put chain-B content onto chain-A's thread. Chain-A's agents have no decision to make about chain-B; their inbox should not see it.

**IMPORTANT:** The handoff IS the ack. Forwarding output to the next stage acknowledges the previous stage by definition. Do not also send a separate "thanks, forwarding" reply back upstream — that is an echo with no recipient action.

### Outcome line

End every multi-step task with **one outcome line**: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times — whatever's load-bearing). No play-by-play, no restatement of the ask. Single-step replies don't need this.
