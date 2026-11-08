---
type: runbook
description: /supervise-issues blind spots that live in GitHub state scan never reads — DIRTY auto-merge, merge-queue eviction, orphaned drafts, cross-chain resume triggers, reporter self-PRs (shapes 7, 8, 9, 15, 16). Split from supervise-tick-blind-spots.md 2026-11-07.
---

# Scan blind spots: GitHub state scan can't see

Part of [[orchestrator/supervise-tick-blind-spots.md]] (hub). Shape numbers are stable. Siblings:
[[orchestrator/supervise-tick-blind-spots-session-stalls.md]], [[orchestrator/supervise-tick-blind-spots-dead-turns.md]].

7. **Approved + auto-merge armed, but the PR is `DIRTY`** (tick 283, #13537). Master moves after approval, the branch
   conflicts, auto-merge silently never fires. scan reads `awaiting_us`; `ci.py` shows ✅ (DIRTY isn't BEHIND, so no
   rebase-nudge cell). Detector: every open PR with `autoMergeRequest != null` and `mergeStateStatus == DIRTY`. Nudge
   the `pr-mappings` owner pinned to merge master (merge commit, keep the approver's commits); acked in 2 min. Sweep
   (`gh pr list` GraphQL 502s often): `gh api 'repos/<o>/<r>/pulls?state=open&per_page=100&page=N' --jq
   '.[]|select(.auto_merge!=null)|.number'`, then `pulls/<n>` → `mergeable_state` (`dirty`/`behind`). The first sweep
   found #13171 (behind 66; its only CI run yielded at the priority gate 2 days earlier, never retried) and #12820
   (approved 09-03, dirty, 281 behind) — invisible for weeks.
8. **Approved bot PR evicted from the merge queue** (tick 284, #13171). Merge-group CI lost 3 Windows debug GPU runners
   ("runner lost communication", infra); the queue removed it, which also drops auto-merge, so the PR is `BLOCKED`
   with green PR CI and no `auto_merge` — shape 7's sweep no longer sees it. The babysitter reports evictions, but the
   bot can't re-enqueue. Detector: for each open approved bot PR, `issues/<n>/timeline` ends in
   `removed_from_merge_queue` with no later `added_to_merge_queue`. No coworker nudge; board it as an operator call
   (requeue, or ask the approver).
9. **Open bot draft whose target issue closed under it** (tick 297: #13650 after #13644 merged, #13699 after
   jkwak-work's #13715 closed #13446; also #13079, #13154, and #13741 with one closed ref plus the open #10522). Closed
   chains drop out of scan, so nobody owns closing the draft. Detector: one GraphQL
   `search(is:pr is:open author:app/nv-slang-bot)` with `closingIssuesReferences{number state closedAt}`; any row whose
   every closing ref is CLOSED goes on the board as an operator call (close with a pointer to the superseding PR).
15. **A merged PR fires a resume trigger that lives only in chain memory** (tick 318, #13658). jkwak-work's #14132
    (merged 10-31, closing #13902) changed WGSL emission and broke a CHECK in operator-held draft #13669; the #13902
    record said "Resume on: … merging (→ tell the #13669 owner …)". Detector: for every merged PR and closed issue in
    `closed-since.txt`, `grep -rl '<num>' memory/slang/` and read each hit's **Resume on:** line; nudge the
    `pr-mappings` owner pinned (acked in 45 s). Tick 327: jkwak-work's #14299 turned off tests that drafts #14317/#14314
    also edit, so both went DIRTY unseen; both merge-master nudges were pushed within 7 min.
16. **The reporter's own fix PR lands after dispatch, and the chain never learns of it** (tick 321, batch
    #14151–#14160). Within ~1 h the reporter opened 8 `Fixes #N` PRs (#14164–#14176); a cross-reference fires no
    issue webhook. #14153 had a fixer and reviewer building a wider fix in parallel with #14170. Detector: for every
    new or R6-held human-filed chain, `gh api repos/<o>/<r>/issues/<n>/timeline` → keep `cross-referenced` events
    whose source is a PR by the reporter, then grep the chain record for that PR number. If the chain has a fixer,
    send a pinned heads-up: compare the PRs, report to the parent, no GitHub writes. **State only what the PR is and
    touches, never what it fails to cover:** I wrote "#14170 has no `RWBuffer<float>`/half" but its
    `isTextureAccess` includes `RWBuffer`; the fixer's 14-probe matrix corrected me in 3 min.
    Tick 329: minco3 opened #14379 (`Fixes #14378`) 20 min after our triage offered them the PR. Its `assigned` event
    at the same second has `assigner=github-actions[bot]` (auto-assign of the requested reviewer) — not a maintainer
    self-assign (rung 4).
