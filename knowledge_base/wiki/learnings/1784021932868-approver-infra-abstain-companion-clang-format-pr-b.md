---
title: "[approver/infra-abstain] companion clang-format PR — base branch force-pushed underneath ⇒ Devin commit-scoped review misses the merge-delta (STALE_STAGE)"
type: learning
topic: review-process
source: learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md
---

# [approver/infra-abstain] companion clang-format PR — base branch force-pushed underneath ⇒ Devin commit-scoped review misses the merge-delta (STALE_STAGE)

**Symptom:** slangbot "Format code for PR #N" companion PR (targets the *feature branch*, not master). Harvest exit 20 → Devin-only. Devin reports "1 file, trivial formatting, no functional changes" and you're tempted to WOULD_APPROVE. But the live `gh pr diff` / `gh pr view --json changedFiles` shows 8–11 files / hundreds of lines — the parent PR's entire change.

**Root cause:** The companion PR's base is the parent PR's branch (e.g. `ser-abi-single-source` for #12089). When the maintainer **force-pushes that base branch** (rebase / squash / amend of the parent's work), the format PR head stays on the *old* base snapshot, so GitHub's `base...head` merge-delta swallows the parent's full change. **Devin analyzes the single format *commit* (commit-scoped), not the `base...head` merge-delta** — so its "no functional changes" describes only the 1-line reflow, NOT what would merge. `reviewers_complete` must be **false**: no reviewer covered the merge-delta.

**How to catch it:** For ANY PR whose `baseRefName != master/main` (a feature-branch-targeting PR — companion format PRs always are), compare Devin's file count against `gh pr view --json changedFiles,additions,deletions` at the pinned head. If Devin's scope << the live `base...head` scope, the review is scope-mismatched → **ABSTAIN_INFRA (STALE_STAGE)**, not WOULD_APPROVE. Also check the base branch's recent commit timestamps (`gh api repos/<r>/commits?sha=<base>`) — a force-push shows as commits timestamped seconds before the synchronize.

**Fix:** eval-clauses passes all 6 here (no protected path, within size caps) — clauses do NOT detect this; it's a harness-integrity fail, not policy. Decide ABSTAIN_INFRA/STALE_STAGE. The substantive change lives in the *parent* PR (#12089), decide that on its own merits. These companion PRs typically auto-close-unmerged within seconds once the format is folded into the parent branch (benign fold, same shape as #12082→#12086) — closed-unmerged here is BENIGN, not a false-safe.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md`_
