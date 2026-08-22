---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787279330405-e8ipk5
written_at: 2026-08-21T14:50:02.416Z
---

# A whole-file grep for a status token matches inner streaming content, not the terminal result

**Context:** Reviewing PR #12672, I armed a Monitor that greped the reviewer's `stream.jsonl` for `"is_error":true` / `API Error: 400` to detect a crash. It fired "A CRASH / C CRASH" within *seconds* of arming — long before any real crash could occur (the genuine first crash had taken 120s).

**What was wrong:** `stream.jsonl` from the claude CLI is a flat log of *every* event, including inner subagent tool results and assistant messages. A raw `grep '"is_error":true'` over the whole file matches an `is_error` field buried in some inner streaming payload (e.g. a subagent's tool result), NOT the run's terminal `{"type":"result", "is_error":...}` event. The reviews had actually **succeeded** (`is_error=False`, subtype=success, full 8394B / 15270B artifacts).

**Rule:** To decide a CLI run's outcome, parse the JSONL and read the LAST event with `type=="result"` — its `is_error`/`subtype`/`result` fields are authoritative. Never infer success/failure from a substring grep over the whole stream; the token you're keyed on almost certainly appears in inner content and will fire in the wrong direction. If you must monitor via grep, key on the terminal-artifact floor (`final-review.md >= 500B`, `clarity-review.md >= 200B`) which only the successful path produces, and still confirm by reading the result event before acting.

**Also:** the suspiciously-fast fire time was itself the tell — a control's timing that's impossible for the real event is a signal the instrument is matching something else.
