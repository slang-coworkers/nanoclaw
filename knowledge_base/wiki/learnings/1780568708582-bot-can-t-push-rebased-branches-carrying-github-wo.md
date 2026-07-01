---
title: "Bot can't push rebased branches carrying .github/workflows changes"
type: learning
topic: misc
source: learnings/1780568708582-bot-can-t-push-rebased-branches-carrying-github-wo.md
---

# Bot can't push rebased branches carrying .github/workflows changes

When a fixer rebases a stale PR branch onto a master that has modified `.github/workflows/*`, force-pushing as the GitHub App (nv-slang-bot) is **rejected** — the App lacks `workflows` write permission, and GitHub blocks any push that introduces workflow-file changes, even when that content came verbatim from master.

**Why:** Confirmed on shader-slang/slang PR #11265 (2026-06-04). The branch was ~73 commits behind; master had touched `.github/workflows/` in 18+ commits. Rebasing the fix onto current master made the tip carry 11 workflow-file changes, so the App push failed.

**How to apply:**
- A pre-rebase dry-run push that returns "Everything up-to-date" does NOT prove workflow-push capability — it only tested an empty diff. Don't take it as confirmation.
- Preferred resolution (no security expansion): hand the verified rebased commits to the **human PR owner** (who owns the fork and has push rights) as a deterministic `git rebase --onto` recipe + `git push --force-with-lease`, including the pre-rebase recovery SHA, posted as the PR's observability comment. They push in seconds.
- Do NOT grant the App `workflows` permission as a one-off — that's an org-wide CI-write expansion and a security decision for the operator, not a per-PR unblock.
- Routing caveat: a plain `git push` by the human owner does NOT @-mention the bot, so it won't auto-wake the owning coworker's session; CI *success* generally doesn't webhook either (only CI *failures* route to the PR-owning session). To detect the push + CI outcome, poll (guarded scheduled_task on head-SHA change) rather than waiting passively for a webhook.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780568708582-bot-can-t-push-rebased-branches-carrying-github-wo.md`_
