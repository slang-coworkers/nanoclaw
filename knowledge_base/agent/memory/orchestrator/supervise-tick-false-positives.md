---
type: runbook
description: Recurring /supervise-issues rows that scan.py flags as nudge/escalate/cost-notice but are not real — each shape with its detector and the disposition token to record. Split from the tick runbook 2026-10-13.
---

# /supervise-issues false-positive shapes

Verify every `action=nudge`/`escalate` row before acting; for each shape below, record the disposition in
`disp-overrides.json` and re-scan. Procedure lives in [[orchestrator/supervise-tick-runbook.md]]; the opposite failure
(real stalls scan misses) is [[orchestrator/supervise-tick-blind-spots.md]].

| Shape | Detector | Disposition |
|---|---|---|
| Bot-filed follow-up whose only session is Main's (a nudge would come back to me) | 0 comments, Main-only session; check assignee | assigned to a human → `advisory:maintainer-driving`; otherwise `advisory:unrouted-bot-filed` or `triaged:awaiting-pickup` |
| Bot-filed follow-up with a gated dispatch task | `ncl tasks get` shows an `iNNNNN-maintainer-gate-*` task | `advisory:maintainer-driving` |
| Maintainer-filed, self-assigned issue (Main-only session) | assignee = the filer | `advisory:maintainer-driving` |
| New chain whose fixer acked `[Ack — HELD]` while a maintainer self-assigned | fixer's newest `out` is the HELD ack | `advisory:maintainer-driving` |
| Human-last, but it's a maintainer APPROVE / ready-flip with no ask of the bot | last activity is a review APPROVE | `advisory:maintainer-driving` |
| Human PR author reclaiming their PR ("picking it back up") | author comment | advisory, not owed |
| `github-actions[bot]` read as a human (scan's `is_bot` misses it) | last comment is a PR-board-sync notice (#13544) | not owed; treat as bot |
| A triage that posted between pull and scan reads as `silent` | issue's last comment is newer than the pull | none — re-check, don't nudge |
| Newest row is an `in` but the session was correctly silent | `.claude-trace` final response is an `<internal>` "no reply owed" turn (#13544 triager) | none |
| Human-last, but the reply went into an **in-place edit** of our earlier comment (scan reads only comment `created_at`) | our comment's `updated_at` is after the human comment; the triager's `[Report]` says "edited in place" (#13632, #13653, tick 294) | `external-pr` when a reporter PR owns the fix, else `advisory:…` |
| Burst of reporter replies all answered within minutes (one contributor, many chains) | Main's newest `out` on each chain is after the comment; check per chain, not as a batch (albertrodriguezclo, 13 chains, tick 294) | `external-pr` / `advisory:maintainer-decision` |
| `needs_cost_notice` re-armed by a PR merge or a moved activity stamp | `ncl cost-cap escalations --group <folder>` shows the **same** `pending` `cst-…` row and state has a live `costNoticeUrl` (#13555 twice) | don't re-post |

**Cost-notice target** is the PR the stopped reviewer was reviewing, which can differ from the chain's own PR (the
#13489 chain's PR is #13502, but its reviewer was on #13514). Read the stopped session's newest inbound
`[Fix Review Request]` to find it.

`watch:` / `handed-off:` are not tokens scan.py recognizes — re-tokenize to `advisory:…` or the row keeps re-flagging.
