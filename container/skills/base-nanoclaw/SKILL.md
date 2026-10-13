---
name: base-nanoclaw
license: MIT
description: NanoClaw host tools — send messages, schedule tasks, ask the user questions, append durable learnings. Trigger whenever you need to communicate mid-work, schedule recurring checks, or record something for other coworkers.
provides: []
allowed-tools: mcp__nanoclaw__send_message, mcp__nanoclaw__send_file, mcp__nanoclaw__add_reaction, mcp__nanoclaw__ask_user_question, mcp__nanoclaw__send_card, mcp__nanoclaw__append_learning, mcp__nanoclaw__install_packages, mcp__nanoclaw__add_mcp_server, mcp__nanoclaw__request_restart, mcp__nanoclaw__report_pr_created
---

# NanoClaw Host Tools

Cross-cutting tools for status updates, scheduling, elicitation, and durable learning capture.

## When to use each

| Tool                                                                       | Use when                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `mcp__nanoclaw__send_message`                                              | Mid-work progress update on a long-running task  |
| `ncl tasks create`                                                         | Recurring sweep, periodic check, deferred action |
| `ncl tasks list` / `pause` / `resume` / `cancel`                           | Manage your own scheduled tasks                  |
| `mcp__nanoclaw__ask_user_question`                                         | Bounded user decision (multiple choice)          |
| `mcp__nanoclaw__send_card`                                                 | Structured status panel clearer than prose       |
| `mcp__nanoclaw__append_learning`                                           | Durable discovery future coworkers should reuse  |

## Nuance beyond the MCP schemas

- **send_message pacing.** Short turn (1-2 calls): don't narrate. Longer turn: one-line ack early. Long-running: periodic updates at meaningful transitions (not every call), especially before slow operations.
- **send_file** (`{ path, text?, filename?, to? }`) — deliver a workspace file. `path` is absolute or relative to `/workspace/agent/`. Use for artifacts (charts, PDFs, reports) instead of dumping contents into chat.
- **add_reaction** (`{ messageId, emoji }`) — `messageId` is the numeric `#N` (integer, not string); `emoji` is the shortcode (`thumbs_up`, `heart`, `eyes`).
- **ask_user_question vs send_card.** `ask_user_question` **blocks** your turn until the user picks an option (default 300s timeout; `timeout: 0` waits indefinitely) — use only when you genuinely cannot proceed. `send_card` **returns immediately** — use for status panels or read-only info. For free-text input, send a normal message and wait for the reply.
- **send_card actions are link buttons only.** Each needs a non-empty `label` and an `http`/`https` `url`; anything else — a `#` placeholder, `mailto:`, `tel:` — is dropped before the card is sent, with the count in the tool result. Only top-level `actions` are read at all. `send_card` never renders a callback button, so a card cannot collect an answer: for a clickable choice that returns a value, that is `ask_user_question`, not a link styled to look like one.
- **add_mcp_server takes a `url` too.** Remote Streamable HTTP servers use `url` instead of `command`, over HTTPS — plain HTTP only for loopback (`localhost`, `127.0.0.1`, `[::1]`) and `host.docker.internal`. A URL carrying credentials, a fragment, or a credential-looking query parameter is rejected; auth belongs in OneCLI, not the URL.
- **Credential placeholders.** Never ask for credentials, and never invent credential setup steps for them. In an MCP server config, use the exact marker `"onecli-managed"` for credential fields — OneCLI maintains files carrying it and ignores files that do not. Run `/onecli-gateway` for the rest.
- **Scheduling needs CLI access.** Tasks are `ncl tasks`; there is no scheduling MCP tool. A group whose `cli_scope` is `disabled` cannot schedule at all — the dispatcher rejects the request.
- **Task script gate.** For frequent recurring tasks (more than a few a day), pass `--script` with a bash gate printing `{ "wakeAgent": true|false, "data": {...} }`. You wake only when it prints `true`, saving credits.
- **Each fire is a fresh session.** The system prompt is served from cache and prior history is discarded, so cost stays flat across fires. State that must survive belongs in files, not conversation history.
- **Builds and compilation:** delegate to an `Agent` subagent — never `run_in_background` or a scheduled task for builds. The scheduling bullets above are the whole contract for a typed coworker; only `main` also carries a `## Task scheduling` section.
- **append_learning.** Include a one-line summary, the evidence, and the file/path that proves it.

## Chain reporting mechanics

The four invariants, the applicability note and the routing table are resident in your CLAUDE.md (Chain communication — the rules); this section carries the mechanics behind them.

**Edges (invariant 1).**
```
inbound from PARENT: { id:"abc", source_session_id:"sess-PARENT" }
inbound from PEER  : { id:"p7",  source_session_id:"sess-PEER"   }
<message in_reply_to="abc">…</message>   → parent    send_message(to="parent") → parent (bare)
<message in_reply_to="p7" >…</message>   → peer
```
A session has one parent and may grow to N peers (each peer that writes in mints its own edge). If you genuinely need a deeper tier, ask your child to forward — the chain owns the hop count. Don't fan out to a peer your child is already fanning to (duplicate sessions → work happens twice). The host log _"reply routed back to ancestor session"_ is dead-parent recovery, not a channel; if it fires on a routine `[Report]`, you sent an extra message.

**GitHub (invariant 4).**
- **Canonical thread.** The host stamps `thread_id="gh-issue-<owner>/<repo>-<num>"` on every webhook inbound; reuse it **verbatim** on every downstream dispatch about that issue/PR, across every tier. A sub-thread on the same issue appends `/<sub-task>` — never rewrite or drop the prefix. Non-webhook: pick one `thread_id` at the top of the chain and propagate it identically. **Thread-less status can't route to the per-issue session** — it falls through to the recipient's catch-all (their main chat) and breaks per-tile observability. One `<message>` per chain, on that chain's thread.
- **Post the 5-bullet on every state change** (the tier closest-to-the-state posts; the orchestrator does not post on others' behalf; use the per-project `*-github` skills):
  1. **PR opened** — description carries the rolled-up 5-bullet + `Fixes #N`, call `report_pr_created({repo, pr_number})`. A **draft-held** PR is not a substitute: still post the 5-bullet on the issue ("fix in draft PR #N, held pending review").
  2. **Resolved without a PR** (refusal / out-of-scope / won't-fix / dedup / answered inline) — deepest tier holding the verdict posts.
  3. **Blocked — needs a human** — `ask_user_question(timeout:0)` **and** a GitHub comment with the 5-bullet + question + options.
  4. **Handed off** (awaiting maintainer / external dep) — post the 5-bullet stating the handoff and what resumes it.
- **A human comment re-opens.** A non-bot `issue_comment` is a new chain input **even on a chain you closed/hold** — route it through the same edges. Substantive (counter-proposal, gap, scope-Q, repro) → dispatch on the canonical thread (closest-to-the-state replies). Thanks / ack / restatement → close explicitly with a positive 5-bullet `[Resolution]` whose `next-action:` says why the reply changes nothing. Bot comments (yours or another tier's) are **not** inbounds. Silent close — or silent no-op on a closed chain — is the bug this rule exists to kill.

**Report shape.**
- **Narrative.** Reasoning narrative attaches via `send_file(to="parent")`; when a PR exists its description is the persistent executive summary. Top-of-chain agents deliver the same shape to the **user** via the channel adapter, not to a peer.
- **Roll up** downstream `[Report]`s into your own 5-bullet — one consolidated report, never a verbatim relay.
- **File paths are your own filesystem.** To share a file, `send_file` it (the parent references it as `inbox/<msg-id>/<filename>`); a local path is opaque to peers.
- **No echoes, no meta-acks.** "Acknowledged", "no echo needed", "ending turn" are themselves messages. Nothing substantive → send nothing.
- **One outcome line** ends every multi-step task: result + concrete artifacts (file paths, group ids, PR numbers, round-trip times). No play-by-play; single-step replies don't need it.
- Inbound `thread="…"` appears only when it differs from your own session's — a routing label to copy via `in_reply_to`, not a value to type back into prose.
