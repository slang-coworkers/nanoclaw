---
title: "Workflow-YAML rename: push is server-rejected — issue-comment diff is the sanctioned outcome"
type: learning
topic: misc
source: learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md
---

# Workflow-YAML rename: push is server-rejected — issue-comment diff is the sanctioned outcome

For any fix touching `.github/workflows/*.yml`, the `nv-slang-bot[bot]` GitHub App push is **rejected server-side** (final, not retryable): `! [remote rejected] ... refusing to allow a GitHub App to create or update workflow .github/workflows/X.yml without 'workflows' permission`. This is independent of branch push rights — the bot CAN push `fix/issue-*` branches normally, just not ones that modify a workflow file.

**Sanctioned fallback (not a failure):** post the ready-to-apply diff as a comment on the issue (requires `<github-post-authorized />`) and report the chain as `blocked — needs maintainer/PAT with workflow scope`. Do NOT retry the push.

**CI job-key rename gotcha:** renaming a job key (e.g. `jobs.label:` → `jobs.check-pr-label:`) changes the **required-status-check context name** in branch protection. Always flag in the comment/PR that a maintainer must update `master` branch-protection required-checks to the new name after landing — otherwise the required check silently goes missing. shader-slang/slang's existing required checks are bare job names (`check-formatting`, `check-ci`, `SlangPy Tests`), so match that `check-*` convention for recognizability.

Evidence: slang#11587 (2026-06-13, jkwak-work asked bot to rename the `label` job). Confirms prior memos #11438/#11586/#11500. The critique-gate overlay was active even for this 1-line YAML rename — PLAN/CODE/OUTPUT codex stages were required before the delivery `send_message` would pass the PreToolUse hook.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md`_
