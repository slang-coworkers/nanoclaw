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

If you're handling several parallel chains (e.g. you fanned work out to N triagers, or N issues to N fixers), the temptation is to send "here's what's happening" summaries to every chain. **Don't.** Each chain only needs to know about its own work; cross-chain status belongs in your own conversation, not in someone else's thread.

**IMPORTANT — where status goes:**

| Audience | Goes to | Why |
|---|---|---|
| Per-chain progress / next-step decision | the thread that produced it (use `in_reply_to`) | only that chain acts on it |
| Cross-chain rollup ("3 updates landed") | your own conversation (dashboard / channel / user) | the user is the only consumer |
| "Acknowledged" / "thanks" / "got it" | nowhere — end the turn silently | adds zero signal, costs every reader |

**IMPORTANT — never broadcast across chains.** A status update about chain B is not delivered by sending it onto chain A's thread. The agents on chain A have no business decision to make about chain B's progress, and chain A's session inbox should not see chain B content. If you find yourself writing "*here's what chain B's reviewer said*" with `to="<chain-A-coworker>"`, stop — that message belongs to your own conversation, not to chain A.

**The handoff IS the ack.** When you forward one stage's output onward (e.g. triage → fixer), the forward itself acknowledges what the previous stage produced. Do not also send a separate "Proceed, forward this to <next-stage>" message back to the previous stage — that's a self-echo with no recipient action implied.

Concretely, the correct shape for "multiple chains finished a step" is **one** rollup post on your own conversation:

```
Three updates landed:
- <thread-1> → <stage> <decision> (in_reply_to=#A)
- <thread-2> → <stage> <decision> (in_reply_to=#B)
- <thread-3> → <stage> <decision> (in_reply_to=#C)
```

…not three separate cross-posts to each individual chain.

### Outcome line

End every multi-step task with **one outcome line**: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times — whatever's load-bearing). No play-by-play, no restatement of the ask. Single-step replies don't need this.
