### Chain communication — the rules

These are the only rules you need to route messages correctly within a chain. The `[MUST]` rules are non-negotiable; everything else is mechanics.

#### The session model

**[MUST]** **Your session is your inbox; routing is per-edge.** At session birth the runtime mints **one a2a edge** — your parent's edge — by recording the first inbound row's `source_session_id`. That edge is set at session creation and **never changes**; it is the channel you drive your chain on.

Other wired counterparties may write into the same inbox later; each one mints an additional edge, recorded as that row's `source_session_id`. So a session has one parent and may grow to N peers over time.

`in_reply_to=<their-msg-id>` resolves the inbound row → finds its `source_session_id` → routes your reply down that exact edge. No guessing, no inferring threads from content.

```
inbound from PARENT: { id: "abc", source_session_id: "sess-PARENT" }
inbound from PEER  : { id: "p7",  source_session_id: "sess-PEER"   }

<message in_reply_to="abc">…</message>   → sess-PARENT  (status, [Report], files)
<message in_reply_to="p7" >…</message>   → sess-PEER    (peer side-task)
send_message(to="parent")                → sess-PARENT  (bare; uses parent edge)
```

#### What flows on which edge

**[MUST]** **Status flows up one tier, on the parent edge.** Status / `[Report]` / refusals / file attachments / escalations all flow to your parent via `to="parent"` or `in_reply_to=<parent-msg-id>`. Your parent rolls your status into their own report and passes it further if needed. Don't pre-roll-up by sending the same status to multiple ancestors — that produces duplicate reports and breaks the chain abstraction.

**[MUST]** Every reply to a specific inbound carries `in_reply_to=<id>`. Without it, the runtime falls back to a heuristic that may pick the wrong edge.

**[MUST]** **Close every chain with an upstream report — even on refusal.** If your stage doesn't apply (out of scope, blocked, no downstream forward needed), still emit the `[Resolution]` / `[Report]` your workflow defines and substitute the outcome bullet with `not actionable: <one-line reason>`. The parent decides what happens next; do not drop the chain.

**[MUST]** **Peer pings get peer-edge replies.** When a non-parent writes into your inbox, reply on **that peer's edge** via `in_reply_to=<their-msg-id>`. The peer's task is independent of any chain you're driving for your parent — do not redirect to parent, do not fold into your next `[Report]`, do not multi-cast.

```
peer pings: <message id="p7">Quick question…</message>

  <message in_reply_to="p7">…</message>             → peer edge      ✓
  <message to="parent">peer asked about…</message>  → wrong edge     ✗
  (silently fold into next [Report])                → peer waits     ✗
```

#### Direct edges only

**[MUST]** **Each coworker speaks to direct edges only — one parent up, the children you opened down.** Skipping a tier corrupts the recipient's parent topology: the runtime records every inbound's `source_session_id`, and the most recent ancestor link wins when the recipient asks for `to="parent"`. Reaching past your direct child to its child gives the deeper tier two parents; its replies will silently drift to whichever you wrote last.

```
chain: orchestrator → triage → fixer

WRONG — orch dispatches past triage:
  orchestrator → fixer  "Is the fix done yet?"
  → fixer's source_session_id list now contains both triage AND orch
  → fixer's next "to=parent" resolves to orch (newer) — triage drops out  ✗

RIGHT — orch routes through triage:
  orchestrator → triage  "What's fixer's status?"
  → triage asks fixer if needed, replies upstream with the answer        ✓
```

If you genuinely need a deeper tier's input, ask your child to forward the request. The chain owns the hop count.

Parallel dispatching to the same peer (you and your child both fan-out) creates duplicate sessions on the deeper tier — work happens twice, on two messaging-group wirings.

The "ancestor reply" runtime path (host log: _"Agent reply routed back to ancestor session"_) is a fallback for dead-parent recovery, not a sanctioned channel. If you see it firing for routine `[Report]`s, you sent an extra message you shouldn't have.

#### Routing table

| Intent                         | `to=`    | Notes                                                                                                                                                                                                                                |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status / result report         | `parent` | Always. Bare `send_message(to="parent")`.                                                                                                                                                                                            |
| Continue an existing thread    | the peer | **Requires** `in_reply_to`. Direct edges only — your parent (1 hop up) or a child you opened (1 hop down).                                                                                                                           |
| Reply to a peer who pinged you | (none)   | **Requires** `in_reply_to=<their-msg-id>`. Routes on the peer's a2a edge; never appears in your `[Report]` to parent.                                                                                                                |
| Fresh delegation to a peer     | the peer | **Requires** explicit `thread_id="<task-key>"`. For GitHub-webhook work, see canonical-thread rule below.                                                                                                                            |
| Stuck — need a human decision  | (none)   | `mcp__nanoclaw__ask_user_question` (amber-card UX). Pass `timeout: 0` when there is no acceptable fallback. Do NOT escalate to a peer coworker as an "ask the expert" fallback — peers are for capability gaps, not your indecision. |

#### Canonical thread for GitHub work

**[MUST]** **Propagate the canonical webhook thread, unchanged.** The host stamps `thread_id="gh-issue-<owner>/<repo>-<num>"` on every webhook inbound (the issue/PR number for unmapped comments). Every downstream dispatch about the same issue/PR — across every tier — must reuse that exact key verbatim.

```
WRONG — variants per recipient:
  <message to="<peer-A>" thread_id="issue-<num>">…</message>
  <message to="<peer-B>" thread_id="issue-<num>-input">…</message>

RIGHT — webhook thread propagates everywhere:
  <message to="<peer-A>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
  <message to="<peer-B>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
```

For a sub-thread on a different task that happens to be about the same issue (rare), append-only: `gh-issue-<owner>/<repo>-<num>/<sub-task>`. Don't drop or rewrite the prefix. For non-webhook tasks, pick the `thread_id` once at the top of the chain and propagate it identically.

**[MUST]** **Per-issue routing — never collapse multi-chain status onto one session.** Status / resolution / supervisor-style reports about an in-flight issue chain **must** carry that chain's canonical `thread_id`. Thread-less status from a generic chat session can't route to the per-issue session — it falls through to the recipient's catch-all (their main chat) and breaks per-tile observability.

```
WRONG — N chains rolled into one thread-less dump:
  triage (thread_id=null): "[Resolution] #<a> SHIPPED ... [Resolution] #<b> ..."
  → all rows land in orch's MAIN chat session (catch-all)             ✗

RIGHT — one <message> per chain, on each chain's canonical thread:
  <message thread_id="gh-issue-<owner>/<repo>-<a>" in_reply_to="…">
    [Resolution] #<a> — SHIPPED…
  </message>
  <message thread_id="gh-issue-<owner>/<repo>-<b>" in_reply_to="…">
    [Resolution] #<b> — holding…
  </message>
  → each lands on the recipient's per-issue session                    ✓
```

If you're initiating (no `in_reply_to` available — supervisor cron, fresh dispatch), still set `thread_id`. The runtime resolves to the recipient's session for that thread. `thread_id` is the chain's identity.

#### GitHub as primary observability

**[MUST]** **GitHub is the primary human-observability surface; the dashboard is secondary.** Whenever a chain reaches a state a human might need to see, the coworker holding that state **MUST** post the 5-bullet markdown comment on the originating issue/PR. Silence on GitHub for an in-flight chain is a bug.

The four state-change events that REQUIRE a GitHub comment:

1. **PR opened.** PR description carries the rolled-up 5-bullet + `Fixes #N` / `Closes #N` link to the issue. Call `report_pr_created({ repo, pr_number })`. No separate issue comment needed when the PR description carries it.
2. **Resolved without a PR** (refusal, out-of-scope, won't-fix, dedup, answered inline). Deepest tier holding the verdict posts the 5-bullet — `verdict:` and `next-action:` carry the load.
3. **Blocked — needs a human decision.** `ask_user_question(timeout: 0)` **and** post a GitHub comment with the 5-bullet + question + options (markdown checklist). A human replying on GitHub becomes the next chain inbound via webhook.
4. **Handed off** — awaiting upstream maintainer / external dependency. Post the 5-bullet stating the handoff and what triggers resumption.

**Closest-to-the-state principle.** Reviewer posts the verdict. Fixer posts when the PR opens. Triage posts on out-of-scope refusal. The orchestrator does not post on others' behalf. Use the per-project `*-github` skills wired by trait binding; the spine does not duplicate posting mechanics.

**[MUST]** **A new GitHub comment on an in-flight chain is an inbound to act on, never a default reason to close.** When `issue_comment` arrives on a thread you have an active session for, it must be processed through the chain — same edges, same parent/child rules. Your bot's prior comment does **not** satisfy a human's later reply that introduces new content.

**[MUST]** **A substantive human comment re-opens a closed or holding chain.** A chain you already drove to a terminal state — `[Resolution]`, "holding", "chain closed", "awaiting maintainer" — is **not** immune to new input. When an `issue_comment` lands on such a chain, your own prior `[Resolution]`/"holding" note is a past position, not grounds to no-op. Re-evaluate the comment on its merits exactly as you would on a live chain: if it's a thanks/ack, close again explicitly; if it introduces anything substantive (counter-proposal, gap, scope question, new repro), **re-open** — dispatch to the responsible coworker on the canonical thread, or reply via closest-to-the-state. Reading the comment, recognizing the chain "looks done", and emitting no inbound/outbound is the failure mode this rule exists to kill (observed: forwarded comments landing on resolved chains sat `completed` with zero dispatch until a human nudged).

- A non-bot author writing in is a **new chain input**. If the body is a thanks / OK / restatement, acknowledge with no further routing. If it introduces anything substantive (counter-proposal, gap, scope question, refusal), make a routing decision: forward to the responsible coworker, hold for maintainer input, or close explicitly with a 5-bullet `[Resolution]` whose `next-action:` names what their input changed (or didn't).
- Bot-authored comments (yours or another tier's) are **not** routing inbounds. Ignore them; your past position is a position, not a reply.
- "We already commented" / "the chain is closed" / "we're holding" are **not** answers to a human's later substantive reply. Silent close — or silent no-op on a closed chain — is the bug.

```
inbound: { event: "github.issue_comment", commenter: "<human>",
           body: "<counter-proposal>" }

WRONG: "we posted a comment <N>h ago. chain closed." (no forward, no GitHub reply) ✗
RIGHT: forward to direct child on the canonical thread; child decides; reply lands
       on GitHub via closest-to-the-state.                                         ✓
```

A genuinely-no-follow-up case closes with a positive 5-bullet `[Resolution]` whose `next-action:` says _"no follow-up — author's reply does not introduce a new design point"_. Explicit close is fine; silent close is the failure mode.

#### Reports — shape and content

**[MUST]** **The 5-bullet upstream report shape: status / link / verdict / next-action / blocker.** Use markdown list syntax (`- ` at line start), not Unicode bullets (`•`) — viewers wrap and render markdown; Unicode degrades. Bold each field name (`**Status:**`) so the bullet reads as a labeled fact. Reasoning narrative attaches as a file via `send_file(to="parent")`. Top-of-chain agents deliver the same shape via the channel adapter — to the user, not to a peer.

**Roll up downstream content.** When you are the parent, peers' `[Report]`s arrive at your inbound. Don't relay them verbatim — fold their facts into your own 5-bullet shape and send one consolidated report. The PR description (when one exists) is the persistent executive summary capturing both upstream context and downstream verification.

**File paths in reports refer to your own filesystem.** Each coworker has its own `/workspace/agent/`; files you write there aren't visible to peers. Either (a) the file is one you sent via `send_file` (reference it as `inbox/<msg-id>/<filename>` from the parent's view), or (b) it's a local artifact opaque to the parent (useful for tracing, not openable from elsewhere). To share a file, attach it.

**No echoes. No meta-acknowledgements.** _"Acknowledged silently"_, _"No echo needed"_, _"Ending turn"_ are themselves messages — they cost the reader the same tokens the silent-ack rule was meant to save. Nothing substantive → send nothing.

**One outcome line.** Every multi-step task ends with: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play. Single-step replies don't need this.

Inbound rows show `thread="…"` only when the thread differs from your own session's. Treat it as a routing label to copy via `in_reply_to`, not as a value to type back into prose.
