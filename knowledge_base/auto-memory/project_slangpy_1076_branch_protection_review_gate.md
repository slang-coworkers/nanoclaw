---
name: project_slangpy_1076_branch_protection_review_gate
description: "slangpy#1076 'stuck workflow' = NOT hung — branch-protection review-approval gate (pending CODEOWNERS), not CI; operator-flagged, fixer-confirmed"
metadata:
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

shader-slang/slangpy **#1076** (jkwak's PR) — operator flagged 07-28 ("what is going on with this PR? why is one of the workflow stuck?"). Main gave a preliminary diagnosis; slangpy-fixer (owns the PR session) then verified with fresh `gh` at head `3598937b` and posted the factual answer to jkwak on the PR (**issuecomment-5107256839**).

**CONFIRMED RESOLUTION — NOT a hung/stuck workflow.** All 15 check-runs complete (14 `success` + 1 `skipped` = "Claude Code Assistant"); combined status `success` (CodeRabbit); `mergeable: true` but **`mergeStateStatus: BLOCKED`**. The hold is a **branch-protection review-approval gate**, not CI:
- ccummingsNV approved (MEMBER, 15:59Z).
- **csyonghe / skallweitNV / bmillsNV + `@shader-slang/dev` review requests still PENDING.**
- CODEOWNERS = `* @shader-slang/dev` → the team review requirement isn't satisfied yet.
- **Re-running CI will NOT clear it** — needs maintainer/repo-admin (the outstanding required reviews or a settings change).

**⚠️ Correction to Main's earlier preliminary read:** Main hypothesized "a required status check (likely the skipped `Claude Code Assistant`) never reports success → merge-gate waits." The fixer's verification shows the skipped Claude Code Assistant is **NOT** the blocker (combined status is already `success`); the real gate is the **pending CODEOWNERS reviews**. Directionally right (merge-gate, not hung workflow) but the specific mechanism was wrong.

**Bot cannot name the exact required gate** — 403 on BOTH branch-protection endpoints (`required_status_checks` + branch-protection). Fixer correctly did NOT fabricate a required-check name; a maintainer with repo settings access is best placed to identify the outstanding requirement. Comment hygiene: last commenter was jkwak → new comment (not edit-in-place), per [[feedback_github_comment_hygiene]].

**State:** answered on GitHub; nothing on our side. Terminal-pending the pending CODEOWNERS reviews (maintainer-driven). No code, no further action — this is jkwak's PR; the gate is human review approvals.

**Reusable diagnostic:** `mergeStateStatus: BLOCKED` + `mergeable: true` + all checks green ⇒ suspect a branch-protection **review** gate (pending required reviewers / CODEOWNERS), not CI. Bot 403s on branch-protection endpoints so it can't enumerate the exact requirement — say so, don't guess a check name.
