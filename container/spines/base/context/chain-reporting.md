### Chain communication — the rules

Four invariants govern every message you send in a chain. Hold these; everything below them is mechanics.

**THE FOUR INVARIANTS**

1. **[MUST] Route on edges, never guess.** Your session is your inbox. At birth the runtime mints your **parent edge** (the first inbound's `source_session_id`) — it never changes. Every reply carries `in_reply_to=<their-msg-id>`, which resolves the inbound → its `source_session_id` → the exact edge. Speak only to **direct edges**: one parent up, and children you opened down. Never skip a tier — reaching past a child gives the deeper tier two parents, and its replies drift to whichever you wrote last.

2. **[MUST] Always report up, in the 5-bullet shape.** Status / `[Report]` / refusals / file attachments / escalations flow **one tier up the parent edge** (`to="parent"` or `in_reply_to=<parent-msg-id>`). Close **every** chain with an upstream report — even when your stage doesn't apply (substitute the outcome bullet with `not actionable: <one-line reason>`). Your parent rolls your status into theirs; don't pre-roll the same status to multiple ancestors.

3. **[MUST] Peers are their own edge.** When a non-parent writes into your inbox, reply on **that peer's edge** (`in_reply_to=<their-msg-id>`). A peer task is independent of the chain you drive for your parent — never redirect it to parent, fold it into a `[Report]`, or multi-cast.

4. **[MUST] GitHub is the system of record.** Propagate the canonical `thread_id` **unchanged** across every tier; post the 5-bullet on **every** state change; and treat a human comment as a **live inbound** — even on a chain you already closed.

**Applicability.** Invariants 1–3 bind every coworker. Invariant 4 binds the tier that *holds a GitHub-writable state*: a read-only / no-push role satisfies it by **reporting up** (invariant 2), not by posting — it never calls a GitHub write endpoint. And a top-of-chain role with **no parent** (e.g. `main`) reads "up" as **delivery to the user via the channel adapter**, not a `to="parent"` edge.

---

#### Mechanics

**Edges (invariant 1).**
```
inbound from PARENT: { id:"abc", source_session_id:"sess-PARENT" }
inbound from PEER  : { id:"p7",  source_session_id:"sess-PEER"   }
<message in_reply_to="abc">…</message>   → parent    send_message(to="parent") → parent (bare)
<message in_reply_to="p7" >…</message>   → peer
```
A session has one parent and may grow to N peers (each peer that writes in mints its own edge). If you genuinely need a deeper tier, ask your child to forward — the chain owns the hop count. Don't fan out to a peer your child is already fanning to (duplicate sessions → work happens twice). The host log _"reply routed back to ancestor session"_ is dead-parent recovery, not a channel; if it fires on a routine `[Report]`, you sent an extra message.

**Routing table.**
| Intent | `to=` | Notes |
|---|---|---|
| Status / result report | `parent` | Always. Bare `send_message(to="parent")`. |
| Continue an existing thread | the peer | Requires `in_reply_to`. Direct edges only (parent 1 up, or a child you opened). |
| Reply to a peer who pinged you | (none) | Requires `in_reply_to=<their-msg-id>`. Peer edge; never in your `[Report]`. |
| Fresh delegation to a peer | the peer | Requires explicit `thread_id="<task-key>"`. GitHub work → canonical thread below. |
| Stuck — need a human decision | (none) | `mcp__nanoclaw__ask_user_question` (`timeout: 0` when no acceptable fallback). Not a peer — peers are for capability gaps, not your indecision. |

**GitHub (invariant 4).**
- **Canonical thread.** The host stamps `thread_id="gh-issue-<owner>/<repo>-<num>"` on every webhook inbound; reuse it **verbatim** on every downstream dispatch about that issue/PR, across every tier. A sub-thread on the same issue appends `/<sub-task>` — never rewrite or drop the prefix. Non-webhook: pick one `thread_id` at the top of the chain and propagate it identically. **Thread-less status can't route to the per-issue session** — it falls through to the recipient's catch-all (their main chat) and breaks per-tile observability. One `<message>` per chain, on that chain's thread.
- **Post the 5-bullet on every state change** (the tier closest-to-the-state posts; the orchestrator does not post on others' behalf; use the per-project `*-github` skills):
  1. **PR opened** — description carries the rolled-up 5-bullet + `Fixes #N`, call `report_pr_created({repo, pr_number})`. A **draft-held** PR is not a substitute: still post the 5-bullet on the issue ("fix in draft PR #N, held pending review").
  2. **Resolved without a PR** (refusal / out-of-scope / won't-fix / dedup / answered inline) — deepest tier holding the verdict posts.
  3. **Blocked — needs a human** — `ask_user_question(timeout:0)` **and** a GitHub comment with the 5-bullet + question + options.
  4. **Handed off** (awaiting maintainer / external dep) — post the 5-bullet stating the handoff and what resumes it.
- **A human comment re-opens.** A non-bot `issue_comment` is a new chain input **even on a chain you closed/hold** — route it through the same edges. Substantive (counter-proposal, gap, scope-Q, repro) → dispatch on the canonical thread (closest-to-the-state replies). Thanks / ack / restatement → close explicitly with a positive 5-bullet `[Resolution]` whose `next-action:` says why the reply changes nothing. Bot comments (yours or another tier's) are **not** inbounds. Silent close — or silent no-op on a closed chain — is the bug this rule exists to kill.

**Report shape.**
- **Five bullets:** `**Status:** / **Link:** / **Verdict:** / **Next-action:** / **Blocker:**`. Markdown `- ` bullets (not Unicode `•`), bold field names. Reasoning narrative attaches via `send_file(to="parent")`; when a PR exists its description is the persistent executive summary. Top-of-chain agents deliver the same shape to the **user** via the channel adapter, not to a peer.
- **Roll up** downstream `[Report]`s into your own 5-bullet — one consolidated report, never a verbatim relay.
- **File paths are your own filesystem.** To share a file, `send_file` it (the parent references it as `inbox/<msg-id>/<filename>`); a local path is opaque to peers.
- **No echoes, no meta-acks.** "Acknowledged", "no echo needed", "ending turn" are themselves messages. Nothing substantive → send nothing.
- **One outcome line** ends every multi-step task: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play; single-step replies don't need it.
- Inbound `thread="…"` appears only when it differs from your own session's — a routing label to copy via `in_reply_to`, not a value to type back into prose.

**Before ending a turn:** did you report up? is any peer ping unanswered? is any in-flight GitHub state left un-posted?
