---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-13T13:57:08.198Z
---

# Supervisor scan.py false-positive awaiting_us: bot posts from human GitHub accounts

# Supervisor `awaiting_us` false-positive: automated posts from human accounts

**Symptom (measured Tick 222, 2026-09-13, slang#12821 / PR #12823):** `scan.py` classified the chain `awaiting_us` (human spoke last, unanswered) and raised `action=nudge`. On verification by slang-fixer, the "last human comment" was **not** a real human comment — it was an *automated* post from a **human GitHub account**:
- `jhelferty-nv` PR-board-sync markers, explicitly labeled *"do not reply to this comment."*
- CodeRabbit's `coderabbitai[bot]` "review skipped" notice.

`scan.py::is_bot_author` keys on login (`nv-slang-bot`, `coderabbitai[bot]` etc.). It does **not** catch automation posted under a *human* login (`jhelferty-nv` board-sync), so those read as "human-last" → false `awaiting_us` → a wasted nudge.

**Handling this tick:** the nudge was still net-useful (it forced the fixer to verify and confirm the chain is correctly `awaiting_human`/held-for-review, BEHIND-but-mergeable draft, CI priority-yield). No harm, but it inflates `must_nudge` and the awaiting_us count.

**Durable fix (for the scan maintainer):** extend the bot/automation filter to ignore comments whose body carries automation markers (e.g. contains "do not reply to this comment", PR-board-sync signature) even when authored by a human login, OR maintain an `AUTOMATION_LOGINS` set (add `jhelferty-nv` board-sync). Until then, a supervisor tick that nudges a lone `awaiting_us` PR chain should expect the fixer may correctly report it as a bot-from-human-account false-positive.
