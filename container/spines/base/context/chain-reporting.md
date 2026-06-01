### Chain communication — the rules

These are the only rules you need to route messages correctly within a chain. The first three are non-negotiable; everything else is mechanics.

**[MUST]** Every reply to a specific inbound carries `in_reply_to=<id>` from that inbound's `<message id="…">`. The runtime uses it to route precisely; without it, multi-thread chains fall back to a heuristic. Do **not** infer a thread from message content.

**[MUST]** Close every chain with an upstream report — even on refusal. If your stage doesn't apply (out of scope, blocked, no downstream forward needed), still emit the `[Resolution]` / `[Report]` your workflow defines and substitute the outcome bullet with `not actionable: <one-line reason>`. The parent decides what happens next; do not drop the chain.

**[MUST]** **Your session is your inbox; it grows over time as wired counterparties write in.** At session birth the runtime mints **one a2a edge** — your parent's edge — by recording the first inbound row's `source_session_id` as your parent's session. The parent edge is set at session creation and **never changes**; it is the channel you drive your chain on.

Other coworkers may later write into the same inbox. Each one who does mints an **additional a2a edge** between their session and yours — but only if the wiring allows it (their group's destinations include yours; the runtime rejects unwired attempts before they ever reach you). Each inbound row carries its own `source_session_id`, naming the edge that produced it. So a session starts with two members (parent + you) and can grow to N members as peers join.

Routing is per-edge. The runtime uses `in_reply_to=<their-msg-id>` to resolve the inbound row, find its `source_session_id`, and route your reply down that exact edge — no guessing.

```
inbound from PARENT: { id: "abc", source_session_id: "sess-PARENT", thread_id: "…" }
inbound from PEER  : { id: "p7",  source_session_id: "sess-PEER",   thread_id: "…" }

<message in_reply_to="abc">…</message>   → sess-PARENT  (status, [Report], files)
<message in_reply_to="p7" >…</message>   → sess-PEER    (peer side-task — not status)
send_message(to="parent")                → sess-PARENT  (bare; uses parent edge)
```

**The parent edge owns the chain you're driving.** Status updates, completion reports, refusals, file attachments, escalations all flow there via `to="parent"` or `in_reply_to=<parent-msg-id>`. **Peer edges are independent side-tasks.** Answer the peer on their edge — do not redirect their question to your parent, do not fold it into your next upstream `[Report]`, do not multi-cast across edges. The parent decides what to escalate further upstream; that's the abstraction.

Status flows **up one tier**. Your parent will roll your status into its own report and pass it further if needed. Do not pre-roll-up by sending the same status to multiple ancestors — duplicate reports for the operator, broken chain abstraction.

**[MUST]** **A peer who pings you mints a peer edge — reply on that edge, not on your parent's.** When a non-parent writes a `<message to="…" in_reply_to="…">` (or a fresh `<message thread_id="…">`) into your inbound, the runtime has already verified the wiring and stamped the row's `source_session_id` with the peer's session. **Reply to that peer**, on the thread they used, via `in_reply_to=<their-msg-id>`. Their question/file/request is a side-task, independent of any chain you're driving for your parent.

```
peer-A pings you: <message id="p7" thread_id="feat-X">Quick question…</message>
                    inbound row's source_session_id = sess-PEER-A

Reply to peer-A on the peer edge:
  <message in_reply_to="p7">…</message>             → sess-PEER-A   ✓
  <message to="parent">peer-A asked about…</message> → sess-PARENT  ✗ wrong (redirect)
  (silently fold into next [Report] to parent)       → DROPPED      ✗ wrong (peer waiting)
  <message in_reply_to="p7">…</message>
  + <message to="parent">FYI peer asked…</message>   → 2 EDGES      ✗ wrong (multi-cast)
```

The peer side-task does not appear in your `[Report]` to your parent. The parent edge and peer edges are separate channels.

**The "ancestor reply" runtime path is a fallback, not a feature.** You may see host log lines like _"Agent reply routed back to ancestor session"_ — that path exists for the rare case where your parent's session is dead and the runtime has to deliver your message somewhere up the tree. It is **not** a sanctioned channel for routine reports. If your parent's session is alive — you have recent inbound rows from it, or you just sent it a peer message via `in_reply_to` — use that. If you see ancestor-reply firing for your routine `[Report]`, you sent an extra message you shouldn't have.

You can also _initiate_ a peer message when you have a task-level reason of your own — fresh delegation, asking a question, forwarding a file. That mints a peer edge from your side; the same per-edge rules apply going forward. Routine status updates do not multi-cast.

**[MUST]** **The forward direction obeys the same parent-concept rule.** Once you've handed a task to your direct child for a chain (e.g. orchestrator → triage), every subsequent message you send about that same work goes to **that child only**. You do not message the child's downstream peers — not for status checks, not for clarifying questions, not for nudges, not for "just curious how the fix is going." You ask your child; your child asks deeper if needed.

This is the symmetric form of the parent rule: each coworker has _one_ parent (the session opener) and _one_ set of children (sessions they opened). Speak to direct edges only. Skipping a tier corrupts the recipient's parent topology — the runtime records every inbound's `source_session_id`, and the most recent ancestor link wins when the recipient asks for `to="parent"`. If you dispatch past your child to its child, the deeper tier now has TWO parents, and its replies will quietly drift to whichever you wrote last.

```
chain: orchestrator → triage → fixer

WRONG — orch dispatches a "quick question" past triage:
  orchestrator: <message to="slang-fixer" in_reply_to="...">Is the fix
                done yet?</message>
  → fixer's source_session_id list now contains both triage AND orch
  → fixer's next "to=parent" resolves to orch (newer link), bypassing triage
  → triage drops out of the loop for the rest of the chain

RIGHT — orch routes through triage:
  orchestrator: <message in_reply_to="<triage-msg-id>">What's fixer's status?
                </message>
  → triage receives it, asks fixer if needed, replies upstream with the
    consolidated answer
```

Parallel dispatching also produces **duplicate sessions on the deeper tier**: if you and your child both fan-out to the same peer for the same task, the runtime mints two distinct sessions on different messaging-group wirings, and the peer processes the work twice. Witnessed on shader-slang/slang #11356 (May 29) and #11339 (May 29) replays — both burned LLM credits running fixer through the same task in parallel.

The right primitive when you genuinely need to reach a deeper tier (not for status, but for actual delegation): tell your child _"forward this to fixer"_ and let your child do the dispatch. The chain owns the hop count.

Routing — pick the right destination, not the loudest:

| Intent                                   | `to=`    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status / result report (the common case) | `parent` | Always. Routes to the session that opened yours. Bare `send_message(to="parent")`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Continue an existing peer thread         | the peer | **Requires** `in_reply_to`. Bare writes are refused by the runtime. The peer must be your **direct edge** — your parent (1 hop up) or a child you opened (1 hop down). Don't message a deeper tier's peer (a grandchild, a sibling-of-a-sibling) even when `in_reply_to` would technically resolve. See _forward-direction rule_ above.                                                                                                                                                                                                                                                                                                                                                     |
| Reply to a peer who pinged you           | (none)   | **Requires** `in_reply_to=<their-msg-id>`. Routes down the peer's a2a edge (`source_session_id` of their inbound row), not your parent's. Peer side-tasks never appear in your `[Report]` to your parent and never multi-cast. Wiring already gated the inbound — if their row reached you, the edge is allowed.                                                                                                                                                                                                                                                                                                                                                                            |
| Fresh delegation to a peer               | the peer | **Requires** an explicit `thread_id="<task-key>"` on the `<message>` tag. **For GitHub-webhook work, propagate the canonical thread the host stamped on the inbound (`gh-issue-<owner>/<repo>-<num>` for issues, the issue/PR number for unmapped comments) — every downstream dispatch about the same issue/PR uses that same key verbatim, no variants, no recipient suffix.** For non-webhook work, derive a stable key from the task identity (file path, ticket id, …). Without a thread_id, the runtime reuses the last inbound thread from that peer and the dispatch lands in the existing session instead of a fresh sub-session. See _Fan-out_ in `tool-instructions/agents.md`. |
| Stuck — need a human decision            | (none)   | Use `mcp__nanoclaw__ask_user_question` to surface the choice in the top-of-chain operator's view (renders as a card with amber/pending indicator, same UX as install-package approvals). Pass `timeout: 0` when there is no acceptable fallback if no one answers. Do NOT dispatch to a peer coworker as an "ask the expert" fallback — peers are for capability gaps in their domain, not for your indecision.                                                                                                                                                                                                                                                                             |

**[MUST]** **Propagate the canonical webhook thread, unchanged.** When work originates from a GitHub webhook, the host stamps a canonical `thread_id` on the inbound: `gh-issue-<owner>/<repo>-<num>` for issues; the issue/PR number for unmapped comments. Every downstream dispatch about the same issue/PR — to every coworker in the chain — must reuse that exact key verbatim. Do not invent variants. Do not strip the `gh-issue-` prefix, do not drop `<owner>/<repo>`, do not append a recipient suffix (`…-triage`, `…-maintainer-input`), do not switch naming schemes between hops. Variants fragment one conversation into multiple dashboard tiles, break `grep thread_id=…` across the chain, and cause the ancestor-reply path to land replies on a sibling thread.

```
<!-- WRONG — inventing a new thread per recipient -->
<message to="<peer-A>" thread_id="issue-<num>">…</message>
<message to="<peer-B>" thread_id="issue-<num>-input">…</message>

<!-- RIGHT — the webhook thread propagates verbatim everywhere -->
<message to="<peer-A>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
<message to="<peer-B>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
```

For a sub-thread on a _different_ task that happens to be about the same issue (rare; usually a follow-up belongs on the same thread), make the suffix explicit and append-only: `gh-issue-<owner>/<repo>-<num>/<sub-task>`. Don't drop or rewrite the prefix. For non-webhook tasks (user-initiated dispatch, periodic check, synthesized request), pick the thread_id once at the top of the chain and propagate it identically downstream.

**Roll up downstream content into your own 5-bullet report.** When you are the parent, peers' `[Report]`s arrive at your inbound. Do not relay them verbatim to your own parent — fold their facts into your own status/link/verdict/next-action/blocker shape and send one consolidated report. The reasoning narrative attaches as a file via `send_file(to="parent")`. The PR description (when one exists) is the persistent executive summary that captures both upstream context and downstream verification — whoever authors the PR keeps it current. This is what "the parent decides what to escalate further" means in practice.

**[MUST]** **GitHub is the primary human-observability surface; the dashboard is secondary.** When work originates from a GitHub issue or PR, humans live on GitHub — they see notifications there, they reply there, they decide there. Whenever a chain reaches a state a human might need to see, the coworker holding that state **MUST** post the 5-bullet markdown comment on the originating issue/PR. The dashboard `ask_user_question` card (see _Routing — stuck_) remains useful as a faster operator-side surface, but it is **secondary**: a chain that updated the dashboard but not GitHub has not been observed by the human. Silence on GitHub for an in-flight chain is a bug.

The four state-change events that REQUIRE a GitHub comment:

1. **Chain complete — PR opened.** The PR description carries the rolled-up 5-bullet ([Report] folded into the executive summary); the PR itself links back to the originating issue via "Fixes #N" or "Closes #N". `report_pr_created({ repo, pr_number })` after opening so the host wires future webhook events back to the chain. No separate comment on the issue is needed when the PR description carries it — but the link from issue → PR must be present.
2. **Chain complete — resolved without a PR** (refusal, out-of-scope, won't-fix, deduped against an existing issue, answered inline). The deepest tier that holds the verdict posts the 5-bullet on the issue/PR explaining what was done and why nothing landed. `verdict:` and `next-action:` carry the load — say _"closing as duplicate of #N"_ or _"out of scope: requires upstream maintainer input"_, not just _"resolved"_.
3. **Chain blocked — needs a human decision.** The coworker calling `ask_user_question(timeout: 0)` **MUST** also post a GitHub comment on the originating issue/PR with the same 5-bullet shape, and the question + options rendered as a plain markdown checklist. A human replying on GitHub with the chosen option (free-text or `> answer: <option>`) becomes the next inbound through the webhook → chain path. The dashboard card resolves only when an operator answers via the dashboard; the GitHub comment is what reaches the human who isn't watching the dashboard.
4. **Chain handed off — won't progress further from this side** (awaiting upstream maintainer, external dependency, vendor escalation). Post the 5-bullet stating the handoff, what was tried, and what triggers resumption.

**Closest-to-the-state principle.** The coworker that holds the state posts. Reviewer posts when the verdict is theirs. Fixer posts when the PR opens. Triage posts on out-of-scope refusal. The orchestrator does not post on others' behalf — it would be relaying second-hand. Each tier is responsible for the GitHub comment for state it owns. Use the existing GitHub-posting skills (per-project `*-github` skills wired by trait binding); the spine does not duplicate the mechanics.

```
issue gets opened on GitHub
              │
              ▼  (webhook → orchestrator)
        ORCHESTRATOR ── dispatches to TRIAGE ───────────────►
              ▲                                              │
              │                                              ▼
              │                                          TRIAGE
              │                                              │
              │                                              ▼
              │                                          FIXER opens PR
              │                                              │
              │                                              │  posts GitHub comment
              │                                              │  on issue: 5-bullet
              │                                              │  + "Fixes #N" in PR body
              │                                              │  + report_pr_created()
              │                                              │
              │  ◄────── final [Report] rolls up ────────────┘
              │
              ▼
       supervisor verifies: was a GitHub comment / linked PR posted?
       if not → nudge the responsible tier to post before closing
```

For top-of-chain agents (no parent) the rule is unchanged: the channel adapter delivers the same 5-bullet shape to the user. When that user is on GitHub (the originating webhook), the channel adapter IS the GitHub comment.

No echoes. No meta-acknowledgements. _"Acknowledged silently"_, _"No echo needed"_, _"Status report stays with the orchestrator"_, _"Ending turn"_ are themselves messages — they cost the reader the same tokens the silent-ack rule was meant to save. If you have nothing substantive to add, **send nothing**.

**File paths in your reports refer to your own filesystem, not your peer's.** Each coworker has its own `/workspace/agent/` (the agent group's mount); files you write there are not visible to other coworkers' containers. When you reference a file in an upstream report, either (a) it's a file the parent already has (because you sent it via `send_file`, in which case reference it as the `inbox/<msg-id>/<filename>` path the parent sees, not your `/workspace/agent/...` path), or (b) it's a path inside _your_ workspace that the parent should treat as opaque (a local artifact, useful for tracing but not openable from elsewhere). Don't write `at /workspace/agent/reports/foo.md` and expect the parent to read it — they can't reach your filesystem. To make a file shared, attach it.

**[MUST]** The 5-bullet shape for upstream reports stays: status / link / verdict / next-action / blocker. **Use markdown list syntax (`- ` at line start), not Unicode bullets (`•`)** — operators view these reports through dashboards and chat clients that wrap and render markdown; Unicode bullets break the list semantically and degrade to raw glyphs in many viewers. Bold the field name (`**Status:**`) so the bullet reads as a labeled fact. Reasoning and narrative go in an attached file via `send_file(to="parent")`. Top-of-chain agents (no parent) deliver the same shape via the channel adapter — to the user, not to a peer.

Inbound rows show `thread="…"` only when the thread differs from your own session's. Treat the attribute as a routing label to copy via `in_reply_to`, not as a value to type back into prose.

End every multi-step task with **one outcome line**: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play. Single-step replies don't need this.
