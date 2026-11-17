---
title: "Agent Routing: Bounce Triage — Failure Bounces, Paused Recipients, and Re-drive Discipline"
type: concept
group: agent-routing
tags: [bounce, failure-card, sorry-something-went-wrong, paused-recipient, session-pinning, re-send, recovery-race, dedupe, redrive]
source_count: 5
---

# Agent Routing: Bounce Triage — Failure Bounces, Paused Recipients, and Re-drive Discipline

A "Sorry, something went wrong" / "turn finished without output — please re-send" bounce is advice, not an instruction. Bounces arrive late, out of order, and in duplicate pairs; the peer often recovers on its own between cards. Re-driving one blindly creates a duplicate workstream that costs far more than the retry saves.

## TL;DR
- A bounce is not a lost handoff. Before re-driving, read the chain-state page (mtime beats memory) and the session transcript for a recovery message from the peer that postdates the bounce — if one exists, do NOT re-send; at most a short "still have what you need?" ping on the peer edge.
- Bounce cards arrive in duplicate pairs, minutes apart; each can wake a separate turn, and a blind re-send crosses the peer's recovery.
- Locate the owner: `NANOCLAW_SESSION_THREAD_ID` names the chain; `ncl sessions list --thread-id <thread>`; pending work = the inbound row(s) newer than the last completed out row.
- Nudge pinned: `in_reply_to=<bounce row id>` + `target_session_id=<owner session>` + `thread_id=<canonical thread>`; verify delivery as a fresh `in` row.
- Check `ncl cost-cap status --session <sid>` before nudging — a cost-escalated/stopped session needs a ceiling escalation, not a transient-error retry.
- Never a bare `to: <coworker>` re-dispatch — bare sends mint duplicate peer sessions; `in_reply_to` on the bounce card may route to a duplicate session that stood down. Pin the owner session and mark "one ack suffices".
- Paused-recipient bounces: the host's redrive/dead-letter sweep is NOT suppressed by group `paused`. Verify the ask is still live (terminal GitHub item, or already covered by the decision table → moot); catalogue the disposition and end the turn with ZERO outbound rows — wrap the final output in `<internal>`.
- During a GitHub 401 auth outage, a public PR page via webfetch still works for merge-state verification while `gh`/curl return Bad credentials.
- Dedupe before telling the operator — parallel Main sessions hit the same redrive sweep; after the first instances the phenomenon is already on the dashboard.
- Cross-container paths in a handoff brief are invisible to the peer — send repro files via `send_file`, not paths.
- State-page edits race between sibling turns processing duplicate cards — re-read the file immediately before editing and prefer small appended bullets.

## A bounce is not a lost handoff — check for in-flight recovery first

A peer's "Sorry, something went wrong" bounce can be delivered LATE, after the peer has already recovered and resumed work: on slang#14474 (2026-11-16) a stale 07:29 bounce triggered a duplicate [Triage handoff] re-send that crossed with the fixer's 07:30 recovery note — the fixer had recovered ~2 minutes after the failure, and the duplicate re-send spawned a duplicate fixer session, costing a supersession message, a wrong-session routing detour, and a parent-escalation correction ([Check the transcript before re-driving a bounced peer — bounces arrive out of order](../learnings/1794814341017-check-the-transcript-before-re-driving-a-bounced-p.md), [Failure bounce is not a lost handoff — check for in-flight recovery before re-dispatching](../learnings/1794815702467-failure-bounce-is-not-a-lost-handoff-check-for-in-.md)). Recovery mechanics that matter more than the retry ([NanoClaw failure-card hygiene: duplicate bounce cards, session pinning, and thread-less sends](../learnings/1794814560808-nanoclaw-failure-card-hygiene-duplicate-bounce-car.md)):

1. **Bounce cards arrive in duplicate pairs** — two identical "Sorry, something went wrong" cards from the same failure, delivered minutes apart, each able to wake a separate turn. Read the session transcript (`ncl sessions messages --id <sess> --reverse`) before re-sending anything; the peer often recovers between the two cards.
2. **Re-read the chain-state page FIRST** — it may already record the recovery (the page moved twice during one turn on #14474; mtime beats memory).
3. **If a re-dispatch is still needed, pin `target_session_id` to the peer's owner session** — a bare `to: slang-fixer` can mint a duplicate peer session, and `in_reply_to` on the bounce card follows the card's source session, which may itself be a duplicate that stood down. Find the owner in the session topology (`ncl sessions list` / the chain-state memo) and mark the message "one ack suffices".
4. **Never obey the canned "turn finished without output — please re-send" card**: re-send only after verifying real silence via the transcript or a scheduled probe.
5. **Cross-container paths in a handoff brief (e.g. `/workspace/agent/...`) are invisible to the peer** — send repro files via `send_file`, not paths.
6. **State-page edits race between sibling turns** processing the duplicate cards — re-read the file immediately before editing, and prefer small appended bullets over rewriting sections a sibling may have rewritten.

## Triaging a generic error bounce: locate the session, then nudge pinned

A generic coworker bounce carries no task context. The triage recipe (measured 2026-11-07, fixer bounce on slang#13375): (1) read `NANOCLAW_SESSION_THREAD_ID` from the container env — it names the chain your session owns, which is the chain the bounce belongs to; (2) `ncl sessions list --thread-id <thread>` to find the coworker's session on that thread, cross-checking container_status/last_active around the bounce timestamp; (3) `ncl sessions messages <session> --reverse --limit 12` — the pending work is the inbound row(s) newer than the last completed out row; (4) nudge with `send_message(to=<coworker>, in_reply_to=<bounce row id>, target_session_id=<owner session>, thread_id=<canonical thread>)` — the in_reply_to resolves the peer edge to the bounced session and the pin lands it in the owner session; (5) verify with `ncl sessions messages <owner session> --reverse --limit 3` that the nudge appears as a fresh `in` row. Also check `ncl cost-cap status --session <sid>` before nudging — a cost-escalated/stopped session needs a different escalation (ceiling raise) than a transient-error retry, and the nudge should tell an escalated session to keep the retry tight and report before burning headroom ([Triaging generic coworker error bounces](../learnings/1794813964705-triaging-generic-coworker-error-bounces-sorry-some.md)).

## Paused recipients and auth-outage redrive sweeps

The host's redrive/dead-letter sweep is NOT suppressed by group `paused`: it drains queued unanswered dispatches through the paused recipient group anyway (measured 2026-11-16 on slang-pr-approver during a GitHub-auth outage — every redriven turn hard-failed, so the originating sessions received "please re-send" bounces). A bounce is not an instruction to re-send — it is advice. Before re-sending, check the bounced ask against live terminality: if the underlying GitHub item is terminal (PR merged/closed) or the ask's own decision table already covers the current state, the ask is moot — do NOT re-send and do NOT reply into the paused group (each reply queues another doomed turn during the sweep); catalogue the disposition in the queue file / memory instead. End such a turn with zero outbound rows: the bounce's sender is the paused recipient's session, so a plain final response follows session_routing back into that session — wrap the whole final output in `<internal>`, not even "no action needed" as plain text. When the GitHub API returns 401 (auth outage), a public PR page via webfetch still works for merge-state verification while `gh`/curl return Bad credentials. Dedupe before telling the operator: parallel Main sessions hit the same sweep, and after the first two instances the dashboard already carries the phenomenon — later instances go only to the per-PR ledger ([Bounced "please re-send" from a paused recipient](../learnings/1794813346684-bounced-please-re-send-from-a-paused-recipient-ver.md)).

**Source learnings (5):**

- [Paused-recipient "please re-send" bounce: verify ask still live](../learnings/1794813346684-bounced-please-re-send-from-a-paused-recipient-ver.md)
- [Triaging generic coworker error bounces ("Sorry, something went wrong")](../learnings/1794813964705-triaging-generic-coworker-error-bounces-sorry-some.md)
- [Check the transcript before re-driving a bounced peer](../learnings/1794814341017-check-the-transcript-before-re-driving-a-bounced-p.md)
- [Failure-card hygiene: duplicate bounce cards, session pinning, thread-less sends](../learnings/1794814560808-nanoclaw-failure-card-hygiene-duplicate-bounce-car.md)
- [Failure bounce is not a lost handoff — check for in-flight recovery](../learnings/1794815702467-failure-bounce-is-not-a-lost-handoff-check-for-in-.md)

_Catalog: [[wiki/index.md]]_
