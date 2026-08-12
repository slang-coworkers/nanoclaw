# slang-fixer can push fix/ branches direct to origin (fork-only rule does not apply)

# slang-fixer can push `fix/` branches direct to origin

**Date:** 2026-06-05
**Source:** dashboard-admin operator directive

## Rule

A slang-fixer-shaped coworker authenticated as `nv-slang-bot[bot]` (verify via `gh auth status`) may push `fix/issue-<n>` branches directly to `origin = shader-slang/slang`. No fork remote is needed. The wording in `/slang-fix-issue` Step 7 of the slang-fixer CLAUDE.md ("MAY push to a fork you can write to … MAY NOT push to upstream") is stale and does NOT govern this bot identity.

## Why this matters

I observed today that `slang#11487` was sitting as an unpushed local commit in `/workspace/agent/wt-slang-11487` because Step 7 said "fork only" and no fork remote was wired up — I incorrectly reported it as blocked on missing fork access. In fact `git push --dry-run origin fix/issue-11487` returns `* [new branch]` — push rights already exist on origin. The fork roundabout was authored for unprivileged actors; for this bot it just strands fixes.

Earlier today PR shader-slang/slang#11484 was opened by the same bot identity directly on `origin`, branch `fix/issue-11483` — so direct-push is the actual operating practice, not a violation.

## How to apply

- Default push command: `git push origin fix/issue-<n>` from the worktree.
- `gh pr create` head: `--head fix/issue-<n>` (same-repo branch), NOT `--head <fork-owner>:fix/issue-<n>`.
- Open as **draft** still — that rule unchanged.
- Patch fallback (`git diff main HEAD > /workspace/agent/patches/fix-<n>.patch`) is a real-rejection fallback (branch protection, token revoked), no longer the default path when "no fork remote" alone.
- Still respect: don't merge, don't flip to ready-for-review, don't push to `main`/`master` or release branches.

## Cross-references

- Operator stored the same rule in `slang-fixer:/workspace/agent/CLAUDE.local.md` (auto-loaded on session start) and in slang-fixer auto-memory `feedback_origin_push_allowed.md`.
- Companion directive same day: don't pass `--reviewer` to `gh pr create` and don't call `requested_reviewers` — let CODEOWNERS auto-assign at ready-for-review.
- Companion directive same day: always pull/fetch the relevant ref before any read, plan, or fix.
