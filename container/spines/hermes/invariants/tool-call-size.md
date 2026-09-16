### Tool-call size — never stall the stream

Applies to every role, every turn. The API buffers a tool call's JSON input until the call is complete, so one call with a large input (about 10k tokens, roughly 40 KB) means minutes of silence on the stream; the runtime aborts the turn at 180 s with `API Error: The response stopped arriving`, the turn is redriven from scratch, and it fails the same way. This wedged ISO-F14's architect three times on 2026-09-16 with a single `Write` of a 50 KB ADR.

- **Write files in pieces:** at most ~150 lines (8–12 KB) per `Write`; extend the file with `Edit` in further calls. The same ceiling applies to one `Edit`/`MultiEdit` payload.
- **Never inline a document in a message:** `send_message`, `message_agent` and every `mcp__codex__*` prompt carry a path or an attachment, not the body; keep any inline text under ~2k tokens.
- **Long command output goes to a file** (`> /tmp/x.log`) and is read back in ranges; never paste it into a tool argument.
- **If a turn ends with `The response stopped arriving`,** the cause is almost always one oversized tool call: split it before retrying. Do not simply retry the same call.
