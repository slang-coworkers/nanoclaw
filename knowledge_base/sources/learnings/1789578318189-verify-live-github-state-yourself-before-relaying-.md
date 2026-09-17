---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-16T17:05:18.189Z
---

# Verify live GitHub state yourself before relaying a coworker's PR ready/merge/approval claim upward as actionable

## Rule

When you forward a downstream tier's **PR-state claim** (draft / approved / mergeable / "just needs a ready-flip") **up to the operator as an actionable ask**, run the live check YOURSELF first — `gh pr view <n> --json isDraft,reviewDecision,mergeable,merged` or the MCP equivalent — before you relay it. PR state goes stale between the coworker's read and your relay (a re-push auto-dismisses approvals; a maintainer flips draft; a new review lands), and a wrong actionable claim in front of the operator costs credibility and risks them acting on nothing.

The general "verify before relaying coworker findings" principle is **not sufficient on its own** — it didn't stop the failure below. Bind the live check to the specific trigger: *an actionable state-claim moving upward*.

## Grounding (the failure this rule fixes)

On shader-slang/slang **#13002**, the triager reported (msg-21) "maintainer-approved; operator just needs to flip it ready to merge." I relayed that to the operator as an actionable escalation ("please mark #13002 ready-for-review — approved + mergeable") **without running `gh pr view` myself**. Within minutes the triager self-corrected after re-verifying live, and my own direct check confirmed: the PR was actually **`draft: false`** (already ready-for-review — no flip needed or possible) and **CHANGES_REQUESTED** by a second maintainer (a comment-style nit), with the first maintainer's APPROVE **auto-dismissed by a re-push**. The msg-21 claim was stale; my relay put a false "please ready-flip #13002" in front of the operator. I only caught it because the coworker re-verified — not because I gated the relay.

## Corollary — don't relay the correction unverified either

When the same coworker recants, verify the **recant's** live state before forwarding it up too. After the triager's correction I ran `github_get_pull_request` on #13002 directly (confirmed `draft:false`, saipraveenb25 DISMISSED, jkwak-work CHANGES_REQUESTED) *before* sending the operator the correction — so the correction was receipts-backed, not a second relay.

## Right-size, don't over-escalate

The false instance had also inflated a standing policy ask (bot self-ready-after-approval). Once #13002 evaporated on inspection, the honest read was that maintainers *are* readying+merging approved bot PRs in practice — so the "stranded approved-held-draft" gap was less acute than the relayed example implied. Re-surface a policy question only with a concrete instance you've verified live.
