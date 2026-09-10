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
