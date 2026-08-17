---
title: "supervise-issues scan.py over-flag: 3 input/gate bugs revert on skill re-sync"
type: learning
topic: agent-ops
source: learnings/1784638375681-supervise-issues-scan-py-over-flag-3-input-gate-bu.md
---

# supervise-issues scan.py over-flag: 3 input/gate bugs revert on skill re-sync

**Symptom (tick 96, 2026-07-21):** `/supervise-issues` scan.py flagged **86 needs_nudge / 8 escalate** raw — verified down to **1 genuine / 0 escalate**. Same recurring FP pattern as ticks 87/89/91/94/95. The skill was re-synced 2026-07-21 06:30, reverting the tick-95 inline patches.

**Three root causes, all localized, all revert on skill re-sync (durable fixes owed upstream):**

1. **`scan.py::parse_ts` crashes on naive datetimes.** Session-DB timestamps (`our_last_outbound`) arrive as naive `YYYY-MM-DD HH:MM:SS`; `datetime.fromisoformat` yields a naive dt that can't `max()` against GitHub's aware ISO stamps → `TypeError: can't compare offset-naive and offset-aware`. Fix: force `dt.replace(tzinfo=timezone.utc)` when `dt.tzinfo is None`.

2. **`pull-universe.sh` only knows `nv-slang-bot` as a bot.** It stamps `is_bot=False` for `github-actions`, `coderabbitai`, `CLAassistant` — so their reviews/comments read as "human spoke last, ball in our court." scan.py's `is_bot_author` honors an explicit `is_bot` bool over `bot_logins`, so passing a wider `bot_logins` isn't enough — you must correct `is_bot` on the comment objects. Fix inline: set `is_bot=True` for authors in {nv-slang-bot, github-actions, coderabbitai, CLAassistant, *[bot]} before scan. (~153 comments corrected; 86→71.)

3. **`scan.py` HUMAN_OWNED gate applied ONLY on the bot-last path** (`we_owe_next_step`), not on `ball==ours` (maintainer commented on their own driving chain) or `ball==none` (comment-less parked chain). So a maintainer's own comment on a `maintainer-driving`/`pr_open` chain false-flipped to `awaiting_us` every tick. Fix: lift the HUMAN_OWNED check to the TOP of `classify()`, returning `awaiting_human` (never `silent`, so escalate counter doesn't trip) before the ball/silence branches. (71→38.) Also widen `HUMAN_OWNED_DISPOSITION` with descriptive tokens the state file actually uses: `maintainer-owned`, `lingering session`, `superseded`, `maintainer-assigned` (38→29). DELIBERATELY do NOT add `awaiting_human`/`pr_open` prefixes — a FRESH human comment must override a stale self-label (the #11476 shape: PR-bearing chain with a new unanswered maintainer ask is still `awaiting_us`).

**Verification procedure that separates genuine from FP:** for each raw-flagged row, check the newest comment's author against the bot set AND read the disposition — maintainer-on-own-PR / approved-awaiting-merge / bot-last-with-linked-PR are FP; a fresh (post-last-tick) substantive @bot ask on OUR PR with the fixer container STOPPED is genuine. Then refresh the verified-FP dispositions into the payload and re-run so `must_nudge` reflects reality (keeps the §3 fails-loud reconciliation honest: sent==must_nudge).

**Why:** all 33 `test_scan.py` cases still pass after the gate lift — the tests only exercised the bot-last path, so the `ball==ours`/`ball==none` gap was untested. Consider adding a test: maintainer-last comment on a `maintainer-driving` chain → `action='none'`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784638375681-supervise-issues-scan-py-over-flag-3-input-gate-bu.md`_
