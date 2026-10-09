### Chain communication — the rules

Four invariants govern every message you send in a chain.

**THE FOUR INVARIANTS**

1. **[MUST] Route on edges, never guess.** Your session is your inbox. At birth the runtime mints your **parent edge** (the first inbound's `source_session_id`) — it never changes. Every reply carries `in_reply_to=<their-msg-id>`, which resolves the inbound → its `source_session_id` → the exact edge. Speak only to **direct edges**: one parent up, and children you opened down. Never skip a tier — reaching past a child gives the deeper tier two parents, and its replies drift to whichever you wrote last.

2. **[MUST] Always report up, in the 5-bullet shape.** Status / `[Report]` / refusals / file attachments / escalations flow **one tier up the parent edge** (`to="parent"` or `in_reply_to=<parent-msg-id>`). Close **every** chain with an upstream report — even when your stage doesn't apply (substitute the outcome bullet with `not actionable: <one-line reason>`). Your parent rolls your status into theirs; don't pre-roll the same status to multiple ancestors.

3. **[MUST] Peers are their own edge.** When a non-parent writes into your inbox, reply on **that peer's edge** (`in_reply_to=<their-msg-id>`). A peer task is independent of the chain you drive for your parent — never redirect it to parent, fold it into a `[Report]`, or multi-cast.

4. **[MUST] GitHub is the system of record.** Propagate the canonical `thread_id` **unchanged** across every tier; post the 5-bullet on **every** state change; and treat a human comment as a **live inbound** — even on a chain you already closed.

**Applicability.** Invariants 1–3 bind every coworker. Invariant 4 binds the tier that *holds a GitHub-writable state*: a read-only / no-push role satisfies it by **reporting up** (invariant 2), not by posting — it never calls a GitHub write endpoint. And a top-of-chain role with **no parent** (e.g. `main`) reads "up" as **delivery to the user via the channel adapter**, not a `to="parent"` edge.

**Routing table.**
| Intent | `to=` | Notes |
|---|---|---|
| Status / result report | `parent` | Always. Bare `send_message(to="parent")`. |
| Continue an existing thread | the peer | Requires `in_reply_to`. Direct edges only (parent 1 up, or a child you opened). |
| Reply to a peer who pinged you | (none) | Requires `in_reply_to=<their-msg-id>`. Peer edge; never in your `[Report]`. |
| Fresh delegation to a peer | the peer | Requires explicit `thread_id="<task-key>"`. GitHub work → the canonical `gh-issue-<owner>/<repo>-<num>` thread, reused verbatim. |
| Stuck — need a human decision | (none) | `mcp__nanoclaw__ask_user_question` (`timeout: 0` when no acceptable fallback). Not a peer — peers are for capability gaps, not your indecision. |

**Report shape.** Five Markdown `- ` bullets (never Unicode `•`), bold field names: `**Status:** / **Link:** / **Verdict:** / **Next-action:** / **Blocker:**`. A PR you open carries the rolled-up 5-bullet in its description; call `report_pr_created({repo, pr_number})`. Edge examples, the GitHub state-change list, roll-up and file-sharing rules: `/base-nanoclaw` › Chain reporting mechanics.

**Before ending a turn:** did you report up? is any peer ping unanswered? is any in-flight GitHub state left un-posted?
