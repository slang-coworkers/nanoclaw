---
title: "GitHub PR and Bot Operations"
type: concept
group: general-misc
tags: [github, pr, bot, merge-queue, authorship, workflows, fork, issue-close, copilot]
source_count: 22
---

# GitHub PR and Bot Operations

Rules, failure modes, and operational patterns for the `nv-slang-bot` GitHub App interacting with the `shader-slang/slang` repository: PR creation, branch ownership, merge queue, permissions walls, bot identity, and issue/PR close hygiene.

## Bot Identity and Commit Authorship

Commits render with a real avatar only when the author email uses the bot's **User ID** (not the App ID). These are two different numbers: the App ID (`3311378`) appears in webhook/installation contexts while the Bot User ID (`274397474`) is what the commit author email must embed (`274397474+nv-slang-bot[bot]@users.noreply.github.com`). Using the wrong number produces ghost-avatar commits. Every bot commit must also carry exactly one co-author trailer crediting the operator at their verified corporate `nvidia.com` address — never a fabricated numeric id, which can silently resolve to a different GitHub user. ([CONSOLIDATED: GitHub commit authorship for the bot (correct author email; never fabricate trailer ids)](wiki/learnings/1780558703304-CONSOLIDATED-github-commit-authorship.md))

Before the first commit of any session, read the `feedback_commit_author.md` memory file rather than relying on in-session recollection — in one incident four commits shipped with the wrong email, requiring a 31-commit `filter-branch` rewrite and force-push. ([Read auto-memory feedback files before authoring commits — don't trust your own knowledge of email/identity formats](wiki/learnings/1779895141195-read-auto-memory-feedback-files-before-authoring-c.md))

## PR Ownership Classification

A `fix/issue-<N>` branch name does NOT prove a PR is bot-authored. Human NVIDIA engineers (e.g. `szihs`) use the same naming convention on their own forks. Before treating any PR as bot-owned, verify both: (1) the author login ends in `[bot]` and (2) `isCrossRepository == false`. If either check fails, the PR is human-owned and the correct posture is watch-only — no push, no comment, no CI action. ([Bot-owned vs human-contributor PR: fix/issue-* branch name is NOT proof of ownership](wiki/learnings/1780903497625-bot-owned-vs-human-contributor-pr-fix-issue-branch.md), [Branch name fix/issue-N on an external fork can fool 'ours' PR classification](wiki/learnings/1780903498636-branch-name-fix-issue-n-on-an-external-fork-can-fo.md))

## Dev↔Prod A/B Test Separation

Two NanoClaw instances run the slang pipeline against the same live issues, both as `nv-slang-bot[bot]`. This is an intentional A/B comparison — do not consolidate or close duplicates. The dev instance uses `fix/issue-*` branches; prod uses `dev/slang-fixer/*`. Never push commits onto a prod-instance PR branch, as that contaminates the A/B data point. All `nv-slang-bot`-authored PRs (including `dev/trelby/*` branches) are dev-instance–owned and eligible for management actions. ([CONSOLIDATED: dev↔prod duplicate PRs are an intentional A/B test](wiki/learnings/1780558152382-CONSOLIDATED-dev-prod-ab-pr-conventions.md))

## Workflows Permission Wall

The `nv-slang-bot` GitHub App lacks the `workflows` write permission. Any push (rebase or merge) onto a branch whose tip carries `.github/workflows/*` changes will be rejected at the ref-level — even if the bot's own commits touch zero workflow files — because GitHub compares the old vs. new tip trees. `git push --dry-run` and `git ls-remote` are **false positives**: they succeed even though the real push will fail. The only way to confirm push capability is to attempt the real push with `--force-with-lease`. Stripping workflow files to match the old tip is harmful because a squash-merge would then silently revert master's workflow changes. Resolution requires either granting the App `workflows` permission (org-wide decision) or having a human push the rebased commits. ([Bot can't update a stale PR branch when master changed .github/workflows (App lacks workflows perm)](wiki/learnings/1780567931645-bot-can-t-update-a-stale-pr-branch-when-master-cha.md), [Bot can't push rebased branches carrying .github/workflows changes](wiki/learnings/1780568708582-bot-can-t-push-rebased-branches-carrying-github-wo.md), [git push --dry-run is a false-positive for the GitHub-App workflows-permission wall](wiki/learnings/1780572980623-git-push-dry-run-is-a-false-positive-for-the-githu.md))

This same wall applies to the merge queue: `enqueuePullRequest` for PRs touching `.github/workflows/*` is blocked even if the general enqueue block is later lifted, because the queue builds a merge commit including the workflow diff. ([Bot enqueue of workflow-touching PRs has a second blocker (workflows permission)](wiki/learnings/1782727631172-bot-enqueue-of-workflow-touching-prs-has-a-second-.md))

## Merge Queue Blocks and Enum Collisions

The bot cannot enqueue ANY PR (fork or same-repo) to the merge queue — `enqueuePullRequest` is rejected with "not authorized to push to this branch" regardless of PR authorship. When GitHub appears to auto-requeue a bot PR, that is GitHub's own behavior. The correct audit action is `action:"left"` and rely on GitHub-auto or maintainer manual requeue. `gh run rerun --failed` still works for CI reruns. ([Bot enqueuePullRequest blocked for ALL PRs, not just forks](wiki/learnings/1782260121429-bot-enqueuepullrequest-blocked-for-all-prs-not-jus.md))

Two PRs appending to the same public enum (`CompilerOptionName`) can collide in the merge queue with a `duplicate case value` compile error even when both pass CI individually. The fix is to renumber your enumerator above the highest claimed value across master and the active queue-mate. Dequeue first via GraphQL `dequeuePullRequest` (gh has no dequeue verb), then rebase and push with `--force-with-lease`, and wait for a maintainer requeue. ([Merge-queue duplicate-case enum collision: two concurrent PRs appending to the same public enum](wiki/learnings/1782535032557-merge-queue-duplicate-case-enum-collision-two-conc.md))

## Issue and PR Close Restrictions

Coworkers must not close GitHub issues — not even obvious duplicates. Closing is a human-maintainer privilege. The correct action is to post a verified verdict/duplicate cross-link as a comment and leave the close to a human. A deterministic backstop in `container/agent-runner/src/providers/claude.ts` (`detectIssueClose()` + `preToolUseHook`) hard-blocks `gh issue close`, GraphQL `closeIssue(`, and `gh api .../issues/<n>...state=closed` at the tool boundary, independent of what the model was told. ([Coworkers must not close GitHub issues — deterministic tool backstop](wiki/learnings/1782270000000-coworkers-must-not-close-github-issues-tool-backstop.md), [Do NOT autonomously close issues/PRs — surface to a human maintainer](wiki/learnings/1782280210918-do-not-autonomously-close-issues-prs-surface-to-a-.md))

## Copilot Conflict Resolution Race

When a maintainer comments `@copilot resolve the merge conflicts` on a bot-authored PR, GitHub's Copilot agent can also act on the same branch. Before pushing your own conflict resolution, `git fetch` the PR branch to check whether Copilot already pushed. If its resolution is equivalent, `git reset --hard` to the remote tip (adopting Copilot's commit) and add only incremental fixes as a fast-forward push — do not force-push your sibling merge over Copilot's identical resolution. ([@copilot may resolve conflicts on bot-authored PRs — check remote tip before pushing your own](wiki/learnings/1782711499913-copilot-may-resolve-conflicts-on-bot-authored-prs-.md))

## Recurring Merge Conflicts as Supersession Signal

When a maintainer asks to resolve a merge conflict on an approved PR and the conflict recurs — especially with a duplicate diagnostic code or symbol-uniqueness collision — check first whether a competing PR already merged and closed the underlying issue. Mechanically resolving such a conflict re-fixes a closed issue and may produce a build error from duplicate definitions. Surface a close-vs-rework decision to the maintainer rather than force-resolving. ([A recurring merge conflict on an approved PR can mean a competing fix merged — check before resolving](wiki/learnings/1782737882496-a-recurring-merge-conflict-on-an-approved-pr-can-m.md), [Recurring PR conflict may mean the issue was closed by a competing merged PR](wiki/learnings/1782738059209-recurring-pr-conflict-may-mean-the-issue-was-close.md))

## Cross-Fork PR Limitations

The GitHub App can create a cross-fork PR via the REST API with a user PAT (`gh api repos/<base-owner>/<repo>/pulls`), but NOT via `gh pr create` (GraphQL → App token → 403). When no user PAT is available, the fallback is to push to `origin = shader-slang/slang` and open the draft PR against `master`, providing the fork author a cherry-pick recipe. ([Bot (GitHub App) cannot open a PR into a personal fork — use master-base + cherry-pick fallback](wiki/learnings/1781015587691-bot-github-app-cannot-open-a-pr-into-a-personal-fo.md))

## Issue↔PR Linkage Verification

GitHub auto-closes a linked issue on merge for any of `close/closes/closed`, `fix/fixes/fixed`, `resolve/resolves/resolved` followed by `#N`. When verifying PR body linkage, grep for the full keyword set — not just `Fixes`. Also accept the fully-qualified cross-repo form (`Fixes shader-slang/slang-rhi#772`), which requires a pattern allowing an optional `owner/repo` qualifier between keyword and `#`. ([Fixes/Closes link verification must accept the qualified cross-repo form](wiki/learnings/1781072527758-fixes-closes-link-verification-must-accept-the-qua.md), [Verify issue↔PR linkage with ALL GitHub auto-close keywords, not just 'Fixes](wiki/learnings/1781178144676-verify-issue-pr-linkage-with-all-github-auto-close.md))

## force-with-lease Stale Remote-Tracking Refs

`git push --force-with-lease` can fail with `stale info` even when nobody else pushed because `git fetch origin <branch>` only updates `FETCH_HEAD`, not `refs/remotes/origin/<branch>`. Fix: `git fetch -f origin <branch>:refs/remotes/origin/<branch>` to force-refresh the remote-tracking ref, then lease against the true head SHA. Use `git range-diff` to verify a rebase preserves an existing approval. ([force-with-lease 'stale info' — refresh the remote-tracking ref first](wiki/learnings/1782765717544-force-with-lease-stale-info-refresh-the-remote-tra.md))

## Existing Fix PR Check

Before triage recommends a fix — and as a fixer's first step before branching — check whether a fix PR is already open. A maintainer often files an issue and opens a fix PR within minutes with no announcement on the issue. Use `gh pr list --search "Fixes #<num>"` (not `gh search prs`, which has indexing lag) as the detection mechanism. If an open PR already references the issue (especially authored by the reporter/a maintainer), stand down and do not post a redundant bot comment. ([Check for an existing fix PR before recommending OR implementing a fix (esp. maintainer-filed issues)](wiki/learnings/1781241842104-check-for-an-existing-fix-pr-before-fixing-or-recommending.md))

## CHANGES_REQUESTED as Decline Signal

A `CHANGES_REQUESTED` review with an approving/neutral body and zero inline comments is a decline-to-merge signal, not a request for code changes. Before treating it as an edit request, fetch the review body and inline comments (`gh api repos/<o>/<r>/pulls/<n>/reviews` + `/comments`). If the body is positive and comments are empty, reply once acknowledging the no-merge verdict and close the chain upstream with no code change. ([CHANGES_REQUESTED with a 'looks good' body and zero inline comments is a no-merge signal, not an edit request](wiki/learnings/1782512263705-changes-requested-with-a-looks-good-body-and-zero-.md))

---
**Source learnings (22):**
- [GitHub commit authorship (bot user id, co-author trailer)](wiki/learnings/1780558703304-CONSOLIDATED-github-commit-authorship.md)
- [Read auto-memory feedback files before authoring commits](wiki/learnings/1779895141195-read-auto-memory-feedback-files-before-authoring-c.md)
- [Bot-owned vs human-contributor PR: fix/issue-* branch name is NOT proof of ownership](wiki/learnings/1780903497625-bot-owned-vs-human-contributor-pr-fix-issue-branch.md)
- [Branch name fix/issue-N on an external fork can fool "ours" PR classification](wiki/learnings/1780903498636-branch-name-fix-issue-n-on-an-external-fork-can-fo.md)
- [CONSOLIDATED: dev↔prod duplicate PRs are an intentional A/B test](wiki/learnings/1780558152382-CONSOLIDATED-dev-prod-ab-pr-conventions.md)
- [Bot can't update a stale PR branch when master changed .github/workflows](wiki/learnings/1780567931645-bot-can-t-update-a-stale-pr-branch-when-master-cha.md)
- [Bot can't push rebased branches carrying .github/workflows changes](wiki/learnings/1780568708582-bot-can-t-push-rebased-branches-carrying-github-wo.md)
- [git push --dry-run is a false positive for the GitHub-App workflows-permission wall](wiki/learnings/1780572980623-git-push-dry-run-is-a-false-positive-for-the-githu.md)
- [Bot enqueue of workflow-touching PRs has a second blocker](wiki/learnings/1782727631172-bot-enqueue-of-workflow-touching-prs-has-a-second-.md)
- [Bot enqueuePullRequest blocked for ALL PRs, not just forks](wiki/learnings/1782260121429-bot-enqueuepullrequest-blocked-for-all-prs-not-jus.md)
- [Merge-queue duplicate-case enum collision](wiki/learnings/1782535032557-merge-queue-duplicate-case-enum-collision-two-conc.md)
- [Coworkers must not close GitHub issues — deterministic tool backstop](wiki/learnings/1782270000000-coworkers-must-not-close-github-issues-tool-backstop.md)
- [Do NOT autonomously close issues/PRs — surface to a human maintainer](wiki/learnings/1782280210918-do-not-autonomously-close-issues-prs-surface-to-a-.md)
- [@copilot may resolve conflicts on bot-authored PRs](wiki/learnings/1782711499913-copilot-may-resolve-conflicts-on-bot-authored-prs-.md)
- [A recurring merge conflict on an approved PR can mean a competing fix merged](wiki/learnings/1782737882496-a-recurring-merge-conflict-on-an-approved-pr-can-m.md)
- [Recurring PR conflict may mean the issue was closed by a competing merged PR](wiki/learnings/1782738059209-recurring-pr-conflict-may-mean-the-issue-was-close.md)
- [Bot (GitHub App) cannot open a PR into a personal fork](wiki/learnings/1781015587691-bot-github-app-cannot-open-a-pr-into-a-personal-fo.md)
- [Fixes/Closes link verification must accept the qualified cross-repo form](wiki/learnings/1781072527758-fixes-closes-link-verification-must-accept-the-qua.md)
- [Verify issue↔PR linkage with ALL GitHub auto-close keywords](wiki/learnings/1781178144676-verify-issue-pr-linkage-with-all-github-auto-close.md)
- [force-with-lease "stale info" — refresh the remote-tracking ref first](wiki/learnings/1782765717544-force-with-lease-stale-info-refresh-the-remote-tra.md)
- [Check for an existing fix PR before recommending OR implementing a fix](wiki/learnings/1781241842104-check-for-an-existing-fix-pr-before-fixing-or-recommending.md)
- [CHANGES_REQUESTED with a "looks good" body and zero inline comments is a no-merge signal](wiki/learnings/1782512263705-changes-requested-with-a-looks-good-body-and-zero-.md)
_Catalog: [[wiki/index.md]]_
