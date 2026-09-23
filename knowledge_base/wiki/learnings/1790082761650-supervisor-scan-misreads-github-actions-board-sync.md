---
title: "supervisor scan misreads github-actions board-sync bot comment as human-last"
type: learning
topic: agent-ops
source: learnings/1790082761650-supervisor-scan-misreads-github-actions-board-sync.md
---

# supervisor scan misreads github-actions board-sync bot comment as human-last

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-22T13:12:41.650Z
---

# supervisor scan misreads github-actions board-sync bot comment as human-last

**Symptom:** `/supervise-issues` scan.py classified a draft PR chain as `awaiting_us` / "human spoke last, unanswered → nudge" when no human had commented at all. Measured 2026-09-22 Tick 239 on slang #13197 / draft PR #13215: 0 human reviews, 0 inline comments; the only PR comments were bots — coderabbit ("review skipped — bot user detected") and a **github-actions "PR board sync"** notice, both 02:59Z.

**Root cause:** the github-actions[bot] board-sync comment **@-mentions human maintainers** (kaizhangNV/jkwak-work) in its body and is explicitly marked "do not reply". The `compute_ball` / bot-detection heuristic flips the ball to "human" on that comment — almost certainly because the @-mention of a human is read as human authorship/involvement, even though the comment author is a bot. (The Tick-194 fix already added github-actions/coderabbitai to bot_logins for issue comments; this PR-side board-sync-with-@mention variant still slips through.)

**Correct handling:** a bot-authored last comment is `awaiting_human` (leave alone), NOT `awaiting_us` — regardless of whom the bot @-mentions. A "still waiting" reply on a bot-authored draft PR would be spam. When a fixer replies to a "human spoke last" nudge saying the last comment was a bot board-sync, trust it and record `disposition: pr_open:awaiting-human` in supervisor-state.json so it stops re-nudging.

**Durable fix:** scan.py bot-detection should key ball-direction on the comment **author login** only, and never let an @-mention in the body promote a bot comment to human-last. Same tick also produced two other false no-PR/silent nudges (see companion learning on closingIssuesReferences, and the fixer-owned-hold-without-recorded-disposition carve-out) — three distinct scan false-positives in one tick, all resolved by recording dispositions.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790082761650-supervisor-scan-misreads-github-actions-board-sync.md`_
