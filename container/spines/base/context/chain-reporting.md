### Chain communication — the rules

These are the only rules you need to route messages correctly within a chain. The first three are non-negotiable; everything else is mechanics.

**[MUST]** Every reply to a specific inbound carries `in_reply_to=<id>` from that inbound's `<message id="…">`. The runtime uses it to route precisely; without it, multi-thread chains fall back to a heuristic. Do **not** infer a thread from message content.

**[MUST]** Close every chain with an upstream report — even on refusal. If your stage doesn't apply (out of scope, blocked, no downstream forward needed), still emit the `[Resolution]` / `[Report]` your workflow defines and substitute the outcome bullet with `not actionable: <one-line reason>`. The parent decides what happens next; do not drop the chain.

**[MUST]** **Your session has exactly one parent — the coworker that opened it.** When the runtime spawned this session, the dispatcher who wrote the first message into your `messages_in` became your parent for this session. The parent is set at session creation and **never changes for the lifetime of the session**. The data model records it: every inbound row carries a `source_session_id` field — that's your parent's session.

All your replies — status updates, completion reports, refusals, file attachments, escalations — flow to that one parent. Other coworkers may be reachable in your destination list (siblings, your parent's parent, the orchestrator, etc.); **they are not your parent for this session**. Reply to your parent. The parent decides what to escalate further upstream. Trust the chain.

```
inbound:  { id: "abc", source_session_id: "sess-X", thread_id: "…" }
                              ↑
              "sess-X" is your parent for this session

REPORTS (status / [Report] / files / refusals) — to your parent, only:
  send_message(to="parent")                       → sess-X         ✓
  <message in_reply_to="abc">…</message>          → sess-X         ✓
  <message to="<grandparent>">duplicate status…   → ANCESTOR       ✗ wrong
  <message to="<sibling>">duplicate status…       → SIBLING        ✗ wrong
```

Status flows **up one tier**. Your parent will roll your status into its own report and pass it further if needed. Do not pre-roll-up by sending the same status to multiple ancestors — it produces duplicate reports for the operator and breaks the chain abstraction.

**The "ancestor reply" runtime path is a fallback, not a feature.** You may see host log lines like *"Agent reply routed back to ancestor session"* — that path exists for the rare case where your parent's session is dead and the runtime has to deliver your message somewhere up the tree. It is **not** a sanctioned channel for routine reports. If your parent's session is alive — you have recent inbound rows from it, or you just sent it a peer message via `in_reply_to` — use that. If you see ancestor-reply firing for your routine `[Report]`, you sent an extra message you shouldn't have.

You can still talk to a sibling or another wired peer when you have a *task-level* reason — fresh delegation, asking a question, forwarding a file they need. That is a peer message, not a status report, and it carries its own thread_id; it is independent of your status-to-parent flow. Routine status updates do not multi-cast.

The same principle applies in the **forward** direction: when you delegate, dispatch to the next tier you actually own — the coworker whose role is to receive your kind of work. Don't dispatch in parallel to a tier and that tier's downstream peer at the same time, expecting both to process the same task. If a peer needs to reach a deeper tier, they own that hop. Trust them; don't pre-deliver. Parallel forward dispatches produce duplicate sessions, duplicate work, and conflicting results.

Routing — pick the right destination, not the loudest:

| Intent | `to=` | Notes |
|---|---|---|
| Status / result report (the common case) | `parent` | Always. Routes to the session that opened yours. Bare `send_message(to="parent")`. |
| Continue an existing peer thread | the peer | **Requires** `in_reply_to`. Bare writes are refused by the runtime. |
| Fresh delegation to a peer | the peer | **Requires** an explicit `thread_id="<task-key>"` on the `<message>` tag. **For GitHub-webhook work, propagate the canonical thread the host stamped on the inbound (`gh-issue-<owner>/<repo>-<num>` for issues, the issue/PR number for unmapped comments) — every downstream dispatch about the same issue/PR uses that same key verbatim, no variants, no recipient suffix.** For non-webhook work, derive a stable key from the task identity (file path, ticket id, …). Without a thread_id, the runtime reuses the last inbound thread from that peer and the dispatch lands in the existing session instead of a fresh sub-session. See *Fan-out* in `tool-instructions/agents.md`. |
| Stuck — need a human decision | (none) | Use `mcp__nanoclaw__ask_user_question` to surface the choice in the top-of-chain operator's view (renders as a card with amber/pending indicator, same UX as install-package approvals). Pass `timeout: 0` when there is no acceptable fallback if no one answers. Do NOT dispatch to a peer coworker as an "ask the expert" fallback — peers are for capability gaps in their domain, not for your indecision. |

**[MUST]** **Propagate the canonical webhook thread, unchanged.** When work originates from a GitHub webhook, the host stamps a canonical `thread_id` on the inbound: `gh-issue-<owner>/<repo>-<num>` for issues; the issue/PR number for unmapped comments. Every downstream dispatch about the same issue/PR — to every coworker in the chain — must reuse that exact key verbatim. Do not invent variants. Do not strip the `gh-issue-` prefix, do not drop `<owner>/<repo>`, do not append a recipient suffix (`…-triage`, `…-maintainer-input`), do not switch naming schemes between hops. Variants fragment one conversation into multiple dashboard tiles, break `grep thread_id=…` across the chain, and cause the ancestor-reply path to land replies on a sibling thread.

```
<!-- WRONG — inventing a new thread per recipient -->
<message to="<peer-A>" thread_id="issue-<num>">…</message>
<message to="<peer-B>" thread_id="issue-<num>-input">…</message>

<!-- RIGHT — the webhook thread propagates verbatim everywhere -->
<message to="<peer-A>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
<message to="<peer-B>" thread_id="gh-issue-<owner>/<repo>-<num>">…</message>
```

For a sub-thread on a *different* task that happens to be about the same issue (rare; usually a follow-up belongs on the same thread), make the suffix explicit and append-only: `gh-issue-<owner>/<repo>-<num>/<sub-task>`. Don't drop or rewrite the prefix. For non-webhook tasks (user-initiated dispatch, periodic check, synthesized request), pick the thread_id once at the top of the chain and propagate it identically downstream.

**Roll up downstream content into your own 5-bullet report.** When you are the parent, peers' `[Report]`s arrive at your inbound. Do not relay them verbatim to your own parent — fold their facts into your own status/link/verdict/next-action/blocker shape and send one consolidated report. The reasoning narrative attaches as a file via `send_file(to="parent")`. The PR description (when one exists) is the persistent executive summary that captures both upstream context and downstream verification — whoever authors the PR keeps it current. This is what "the parent decides what to escalate further" means in practice.

No echoes. No meta-acknowledgements. *"Acknowledged silently"*, *"No echo needed"*, *"Status report stays with the orchestrator"*, *"Ending turn"* are themselves messages — they cost the reader the same tokens the silent-ack rule was meant to save. If you have nothing substantive to add, **send nothing**.

**File paths in your reports refer to your own filesystem, not your peer's.** Each coworker has its own `/workspace/agent/` (the agent group's mount); files you write there are not visible to other coworkers' containers. When you reference a file in an upstream report, either (a) it's a file the parent already has (because you sent it via `send_file`, in which case reference it as the `inbox/<msg-id>/<filename>` path the parent sees, not your `/workspace/agent/...` path), or (b) it's a path inside *your* workspace that the parent should treat as opaque (a local artifact, useful for tracing but not openable from elsewhere). Don't write `at /workspace/agent/reports/foo.md` and expect the parent to read it — they can't reach your filesystem. To make a file shared, attach it.

**[MUST]** The 5-bullet shape for upstream reports stays: status / link / verdict / next-action / blocker. **Use markdown list syntax (`- ` at line start), not Unicode bullets (`•`)** — operators view these reports through dashboards and chat clients that wrap and render markdown; Unicode bullets break the list semantically and degrade to raw glyphs in many viewers. Bold the field name (`**Status:**`) so the bullet reads as a labeled fact. Reasoning and narrative go in an attached file via `send_file(to="parent")`. Top-of-chain agents (no parent) deliver the same shape via the channel adapter — to the user, not to a peer.

Inbound rows show `thread="…"` only when the thread differs from your own session's. Treat the attribute as a routing label to copy via `in_reply_to`, not as a value to type back into prose.

End every multi-step task with **one outcome line**: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play. Single-step replies don't need this.
