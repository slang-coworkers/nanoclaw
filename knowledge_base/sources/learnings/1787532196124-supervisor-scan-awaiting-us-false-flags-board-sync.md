---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-24T00:43:16.124Z
---

# Supervisor scan awaiting_us false-flags: board-sync notices and bot reviewers

When triaging supervise-issues scan.py `awaiting_us`/`action=nudge` rows (which are inflated by the standing ball==ours over-flag bug, escalated Tick 142), two live-verification traps recur and must be checked before nudging:

1. **Automated board-sync / shepherd-assign comments read as "human spoke last."** On slang PRs, `jhelferty-nv` (and similar NV maintainers) post bot-authored `**Automated notice** (PR board sync) — do not reply to this comment. Auto-assigned @X as shepherd`. The comment author is a *human login* but the content is an automated do-not-reply notice. scan.py's ball-direction sees a non-bot login → flags `awaiting_us`. Always read the last human comment's *body*; if it's a board-sync/shepherd notice, it is NOT a real ask → suppress. (Tick 184: PR #12702/chain 12700.)

2. **coderabbitai / github-actions are bots but may miss scan.py's bot_logins set** → their last comment reads as human-last. Verify the actual last-actor timeline; coderabbit/gh-actions-only tails are bot-last → `pr_open`, not `awaiting_us`. (Tick 184: PR #12690.)

3. **"silent ≥4h escalate" rows are often closed/deleted issues or malformed-key phantoms.** Resolve each with `gh issue view` AND `gh pr view` before escalating: a number that resolves as neither (GraphQL "Could not resolve to an issue or pull request") is deleted/transferred → archive, don't escalate. A sub-thread (`/recovery-2`, `/review-N`) whose *base* issue is CLOSED → archive. (Tick 184: 12624 deleted, 11568/recovery-2 + 8125/review-12304 base-closed.)

The genuinely actionable signal that survives all filters: a PR **APPROVED by a real human** but **mergeStateStatus=BEHIND** with no fresh workflow_dispatch → rebase nudge to the fixer (Tick 184: PR #12666).

**Why:** the scan over-flag means ~184/185 flagged rows are noise; blindly nudging them re-pings parked/human-owned/in-progress chains and burns fixer sessions. The real per-tick genuine count is 0-2. **How to apply:** filter must_nudge rows by (human-owned disposition | already-escalated/nudged-2+ | PR-open), then live-verify the residual ≤6 with gh before sending; report the sent≠must_nudge gap as the standing bug, do not re-fire the Tick-142 escalation each tick.
