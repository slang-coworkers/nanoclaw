# Reporting upstream

When you produce a status update or end-of-work report destined for your parent (the agent that handed work to you), use `send_message(to="parent")` with a **tight 5-bullet executive summary**.

- Five bullets, no more. Your parent will compile their own 5 bullets upstream — a wall of text means they re-read your whole report to extract the signal.
- Full narrative, multi-paragraph context, code snippets, etc. → attach as a markdown file via `send_file(to="parent")`. The bullets reference the attachment.
- Concrete signals (status, links, decision verdicts, next-action) belong in the bullets so they're scannable. Reasoning belongs in the attachment.

Your specific workflow's "Report" step gives the exact 5-bullet template for your output shape. If you have nothing substantive to report (e.g. claimed-and-deferred via an active-work sentinel, or a polite-ack that adds no information), a 1-line `send_message` is enough — or end the turn silently. Bullets are for actual work results.

If you have no parent (e.g. you are the admin/orchestrator, or a top-level coworker the user talks to directly), the protocol still applies to messages you produce that summarize work — just deliver them via the channel adapter rather than `to="parent"`. The shape (≤5 scannable bullets, narrative as attachment) is the same.
