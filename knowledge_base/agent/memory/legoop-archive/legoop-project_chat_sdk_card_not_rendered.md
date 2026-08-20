---
type: project
title: "Pending — `ask_user_question` cards reach pending_questions + delivery layer but don't render in the dashboard thread view; investigate la"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Pending — `ask_user_question` cards reach pending_questions + delivery layer but don't render in the dashboard thread view; investigate later

`mcp__nanoclaw__ask_user_question` calls produce a `chat-sdk` outbound row of `{type: ask_question, ...}`, get a `pending_questions` row, and `Message delivered` fires — but the **dashboard thread view does not render the card**, so the user can't click an option and the question times out at 300s.

**Why:** The dashboard thread view (`/cw/orchestrator/t/<thread>`) appears to render only `chat`/`chat-sdk:text` rows. The `chat-sdk:ask_question` payload likely needs a different surface (admin-cards page or an SSE-pushed widget) that's either not wired or not pointing at the right session/thread.

**Observed:** 2026-05-20 16:06–16:11 on `sess-1779293199721-gu93sy`, question `msg-1779293217796-rx13rx`. Card timed out at 16:11:58; orchestrator self-dispatched to slang-triager at 16:12:06 (driving on its own per the new spine rule, but still — user couldn't see/answer the card).

**Why:** Card delivery + rendering split across two surfaces is brittle; orchestrator's `ask_user_question` is now load-bearing per the [drive-don't-relay] rule we put in main-body.md (#403/#406), so cards that don't render mean every escalation falls back to timeout-then-decide.

**How to apply:** When debugging, check
1. `dashboard/server.ts` — how it queries `pending_questions` and emits SSE events. Look for `ask_question` handling specifically.
2. `dashboard/public/app.js` (or thread-view component) — does it subscribe to a card stream, or only chat events?
3. Whether `platform_id="dashboard:orchestrator"` (where the card was delivered) is the same surface as the URL `/cw/orchestrator/t/<thread>` (probably yes, but verify).
4. Whether [[project_pr_session_mapping]]-style mapping is needed for cards too.

Related code:
- `src/dashboard-ingress.ts` — `/api/dashboard/question-response` (response endpoint that resolves the card)
- `src/db/migrations/*.ts` — `pending_questions` schema
- `container/agent-runner/src/mcp-tools/interactive.ts` — the agent-side ask_user_question implementation
- `container/agent-runner/src/mcp-tools/interactive.instructions.md` — what the agent thinks happens

The 300s default timeout means a card that doesn't render becomes effectively a no-op — the agent gets `Error: Question timed out after 300s` and continues. That masks the bug from the agent's perspective; only the user notices "I never saw a card to click".

