---
name: A <message> block before a tool call in the same turn is silently dropped
description: Dispatching a coworker via a <message> block placed before a later tool call loses the dispatch — only final-response <message> blocks dispatch
type: feedback
originSessionId: ab1ad95b-59b1-42b2-a754-a90278f73bd5
---
A `<message to="X">…</message>` block only dispatches from the **final** assistant response of a turn. If you emit the block and then make ANY tool call afterward (e.g. `send_file`, a Bash poll, a Read), the block becomes a mid-turn block and is **silently dropped** — no error, no trace. The coworker never receives it.

**Why:** Observed on shader-slang/slang#11858 (2026-07-01). I wrote a detailed `<message to="slang-fixer">Fix task:…</message>` dispatch, then called `send_file` in the same turn to attach the memo. The `send_file` (a real MCP call) landed on the fixer session; the `<message>` dispatch did NOT — the fixer's transcript (`ncl sessions messages --id <sess>`) showed only the triager's handoff/memo + my `send_file` text, never the "Fix task:" body. The dispatch's guardrails (draft-only, loop-maintainer-in, report_pr_created reminder) were lost. (Ironically it prevented a double-dispatch that turn, but that was luck, not design.)

**How to apply:** When a turn needs BOTH a coworker dispatch AND tool calls, pick one:
- **Do all tool calls first**, then put every `<message>` block in the final response with NO tool call after it. OR
- **Use `mcp__nanoclaw__send_message({ to, text, thread_id })`** for the dispatch — it's a real tool call and delivers mid-turn regardless of ordering. This is the safer default when tool calls and dispatch are interleaved.
Never leave a `<message>` block "stranded" before a trailing tool call. If unsure whether a dispatch landed, verify with `ncl sessions messages --id <recipient-session>`.
