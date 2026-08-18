---
title: "supervise scan.py: durable fix for chronic 70+ over-flag (parse_ts tz + HUMAN_OWNED gate lift)"
type: learning
topic: agent-ops
source: learnings/1785112718566-supervise-scan-py-durable-fix-for-chronic-70-over-.md
---

# supervise scan.py: durable fix for chronic 70+ over-flag (parse_ts tz + HUMAN_OWNED gate lift)

**Tick 105 (2026-07-27) — applied the DURABLE scan.py fix that ticks 89/91/94/96/98/104 kept diagnosing but re-deriving by hand each tick (the fix reverts on every skill re-sync).** Two edits in `/home/node/.claude/skills/supervise-issues/scripts/scan.py`:

1. **`parse_ts` crash (was fatal EVERY tick).** `pull-universe.sh` emits `our_last_outbound` as naive SQLite `YYYY-MM-DD HH:MM:SS` (no `Z`) for ~59 chains. `datetime.fromisoformat` returns a NAIVE datetime → `TypeError: can't compare offset-naive and offset-aware` in `compute_last_activity_by_us`'s `max()`. **Fix:** in `parse_ts`, if `dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)` (storage is UTC everywhere). Without this the scan produces ZERO output and the whole tick is dead.

2. **HUMAN_OWNED disposition gate LIFTED to top of `classify()`** (the tick-96 prescription, finally in code). Previously the gate lived only inside `we_owe_next_step` (the bot-last `ball=='human'` path), so `ball=='ours'` / `ball=='none'` parked chains leaked into `needs_nudge` — a maintainer commenting last on their OWN assigned issue re-flagged `awaiting_us` + nudge every tick. This was the chronic 70-count over-flag. **Fix:** at the very top of `classify()`, `if human_owned_disposition(chain): return ("awaiting_human", ball, last_by_us, False, "")`. Held UNCONDITIONALLY — no in-code fresh-ask override, because scan can't read comment bodies to tell a maintainer status-update from a genuine @-bot ask; a park that should re-open surfaces as an `updated` delta row the LLM live-verifies, or via the webhook re-open path. Also widened `HUMAN_OWNED_DISPOSITION` with the descriptive tokens the state file actually uses: `maintainer-owned`, `maintainer-assigned`, `design-gated`, `lingering session`, `parked`, `superseded`, `awaiting-classification`, `shadow-approver`, `human-review-gated`, `closing:`, `held for` (deliberately NOT bare `pr_open`/`awaiting_human` prefixes — those are scan's own computed states and would let a stale self-label swallow a fresh ask).

**Result:** raw `must_nudge` 70 → 1 honestly (the 1 residual was the #11568/recovery-2 zombie thread on a CLOSED parent — archived). Added 3 regression tests to `test_scan.py` (`test_ball_ours_maintainer_driving_stays_parked`, `test_ball_ours_no_disposition_still_nudges`, `test_widened_disposition_tokens_park`) — 36 tests pass. The existing suite never exercised `ball==ours` with a disposition, which is exactly why the gate gap survived 5+ ticks.

**Bot re-stamp still owed in pull-universe.sh:** `bot_logins` at `pull-universe.sh:106` is still the narrow `{nv-slang-bot[bot], nv-slang-bot}`. Every tick, 100+ coderabbitai/github-actions/CLAassistant/slangbot/copilot comments arrive `is_bot:false` → read as "human spoke last". The per-tick workaround is re-stamping the payload with `BOT_RE=coderabbit|slangbot|nv-slang-bot|\[bot\]|CLAassistant|github-actions|copilot|devin|^claude$` before scan. **Durable fix owed:** widen `bot_logins` at pull-universe.sh:106 AND emit ISO-Z timestamps (not naive) for `our_last_outbound`/`our_last_push`. Both scan.py + pull-universe.sh edits revert on skill re-sync — the real home is an upstream PR to the supervise-issues skill (coworker-infra owns).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785112718566-supervise-scan-py-durable-fix-for-chronic-70-over-.md`_
