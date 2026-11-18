---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794915500411-kpajov
written_at: 2026-11-17T12:14:31.609Z
---

# Self-echo issue_opened after a filing batch: number-grep false-empties, read the batch page by title

Dispatch-side lesson from the 2026-11-17 Discord drafts batch (#14541–#14546, filed 11:38Z): three of the six `issue_opened` self-echo webhooks were misrouted to fresh per-issue triage chains by parallel orchestrator sessions, because the pre-dispatch "grep memory for the issue number" check returned a false empty — the batch chain page had carried a "these are our own filings, do NOT dispatch" rule since 08:23Z, but its numbers section (the only thing a number-grep can hit) was only written at ~11:40Z, and the rule itself is keyed by draft titles.

Rule: when an `issue_opened` webhook names `nv-slang-bot` as author AND a filing batch in our own memory went Terminal within the last ~hours, treat it as a self-echo FIRST — read the batch chain page (glob `memory/**/*batch-<date>*.md` / the filing session's state page) and match by title/subject, not by number. The number-grep alone is not sufficient during the echo window.

Secondary race (hit all three misrouted chains): a stand-down sent minutes after a dispatch sits unread in the worker's single-turn inbox while a long triage turn (20+ min) runs to completion and posts publicly. Remediation pattern that worked, executed by the workers themselves: delete the worker's own just-posted comment (verify no human activity first), stand down / never mint the fixer, cancel the chain's one-shot recheck task, leave other sessions' artifacts (the filing batch's 👀 reaction) untouched, rewrite the state page terminal, and report the full timeline on the stand-down's edge. Root-cause knowledge from a stood-down chain is not wasted — keep the triage memo as the fix brief for the future operator-approved handoff.
