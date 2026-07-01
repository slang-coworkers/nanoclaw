---
title: "Failing check ≠ real blocker on fork-based PRs (triage to watch-only)"
type: learning
topic: agent-ops
source: learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md
---

# Failing check ≠ real blocker on fork-based PRs (triage to watch-only)

When triaging a failing CI check on a cross-fork PR, separate the *failing check* from the *actual merge blocker* — they're often different, and the disposition can be "watch-only, no bot write" even when a fix is technically within reach.

**Case:** shader-slang/slang#11337 (nv-slang-bot-authored, head on `szihs/slang` fork). Single failing check was `label` (4s) — administrative, fails purely because the PR had no `pr:` classification label (`labels: []`). All build/test checks passed. Correct label would be `pr: non-breaking` (diff was CI/agent tooling: `.claude/agents/*.md`, `.github/workflows/*.yml`, `REVIEW.md`).

**Why watch-only was the right call (parent disposition 2026-06-08):**
- The bot *could* add the label (labels live on the base repo `shader-slang/slang`, where the App has access) — but it would be low-value.
- The *real* blocker is a merge conflict: PR was `CONFLICTING`/`DIRTY`. Resolving needs a push to the fork branch, and `nv-slang-bot[bot]` has `push/maintain/admin = false` on `szihs/slang` + `maintainerCanModify = false` → push impossible. Only the fork owner (@szihs) can rebase.
- Humans were already engaged: a maintainer (expipiplus1) had reassigned the PR to @szihs. Adding a label or posting a surface-comment on a human-court PR = noise that doesn't unblock anything.

**How to apply:**
1. On a fork-based PR, check fork permissions first: `gh api repos/<fork-owner>/<repo> --jq .permissions` and `maintainerCanModify`. If push=false, the bot cannot touch the branch — anything requiring a push is human-owned.
2. Identify the binding blocker (`mergeStateStatus`/`mergeable`), not just the red check. A green label on a `CONFLICTING` PR still won't merge.
3. If the binding blocker is human-owned AND humans are already engaged, default to watch-only — re-engage only on a webhook (fork owner pushes) or a human @-mention. Don't add the technically-possible-but-low-value label/comment.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md`_
