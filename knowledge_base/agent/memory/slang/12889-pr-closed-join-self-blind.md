---
type: project
title: "slang#12889 pr_closed join — false 'no decision exists', corrected"
description: "Approver session bfqfvc wrongly reported the 09-15 pr_closed join as not actionable; its own 09-03 transcript held the ABSTAIN_POLICY decision. Correction pinned 11-16."
---

# slang#12889 — pr_closed join correction (2026-11-16)

- PR shader-slang/slang#12889 "Verify cooperative matrix MapElement tests on SM80" (kaizhangNV),
  head 1c0a7b3d8216e57dc5a473be0c6c9be7090278fc, closed 2026-09-15, NOT merged.
- Owner session: `sess-1788393881829-bfqfvc` (thread gh-issue-shader-slang/slang-12889, group slang-pr-approver, paused=1).
- 2026-09-03: session recorded **ABSTAIN_POLICY** (reason CLAUSE_FAIL:no_protected_paths, policy
  v0-shadow, clauses PASS author_trust + commit_match) and reported "decision recorded to the approval ledger".
- 2026-09-15: `github.pr_closed` webhook (seq 6) delivered to that session; unprocessed until 2026-11-16 06:46.
- 2026-11-16 06:46: session woke and reported "not actionable — no approval decision exists … host ledger
  has no row" — **false**; contradicted by its own seq 7/9 (09-03) receipts. A second errored turn bounced
  06:47, a duplicate report arrived 07:11 from outside bfqfvc's transcript, another error bounce 07:15, and
  the one-owner guard fired at 06:47 and 07:24 (host-side redrive anomaly, possibly self-limiting).
- 07:26: I pinned the correction to bfqfvc (target_session_id + in_reply_to its seq-15 report +
  thread_id), verified delivered (seq 12). Join to be redone against the recorded decision.
- 08:46 (11-16): correction still queued (bfqfvc container stopped, group paused — processes on next wake;
  a re-send would just queue too). One-shot re-check scheduled: `ncl tasks get 12889-join-redo-recheck-9f8e`.
- 09:00 (11-17) re-check: still queued — bfqfvc `last_active` 11-16 07:26 (exactly the correction
  delivery), container stopped, group paused, no transcript rows after seq 12/17. No approver-group
  sessions or error bounces since 11-16 (the 06:47/07:15/08:43 bounce storm self-limited). No re-send
  (queues uselessly). Pending since 11-16 07:26; next natural re-check only if the group is unpaused
  or a new approver webhook/mention lands on this chain.
- Phantom bounces explained (tentative): the 06:43–06:49 bulk wake processed a backlog of old approver
  webhooks across many sessions. #12881's session (sess-1788343834857-1r8xf2) is stuck in the
  critique-gate block loop — blocked 3× as "PR creation" (07:06/07:17), bypass request REJECTED by the
  admin 07:53 (operator demonstrably aware). #12922's session (bns1j4) processed its pr_merged join 06:45;
  a sibling Main session is handling its duplicate copy. The generic error bounces to Main (06:47/07:15/08:43)
  are errored-turn redrives from this sweep, not new #12889 facts.
- Infra noted: approver's PreToolUse critique gate misfired, blocking read-only `gh api`/curl fetches as
  "PR creation"; gh 401 = the known GitHub auth outage (already alerted 04:41Z/07:07Z).

Citations: `ncl sessions messages sess-1788393881829-bfqfvc` (seq 2,4,6,7,9,15,17).
