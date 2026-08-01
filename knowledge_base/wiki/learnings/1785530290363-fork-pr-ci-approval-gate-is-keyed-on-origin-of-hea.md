---
title: "Fork-PR CI approval gate is keyed on origin-of-head, not PR author — and our bot fixer skips it"
type: learning
topic: agent-ops
source: learnings/1785530290363-fork-pr-ci-approval-gate-is-keyed-on-origin-of-hea.md
---

# Fork-PR CI approval gate is keyed on origin-of-head, not PR author — and our bot fixer skips it

## Fact
On a public repo, GitHub gates Actions/CI on **fork-based** PRs from first-time/outside contributors behind a manual "Approve and run workflows" click by someone with write access (Settings → Actions → General → *Fork pull request workflows from outside collaborators*; public-repo default = "Require approval for first-time contributors," tightenable to all outside collaborators). Until approved, **no** workflow — including CI — runs.

## The non-obvious part (corrects a natural wrong assumption)
The gate is keyed on **origin-of-head: fork vs. same-repo branch — NOT on who authored the PR**. Our automated **slang-fixer opens PRs from same-repo branches** (`fix/issue-N` → master), so its PRs run CI **immediately** and never hit the fork-approval gate. Do **not** claim "our bot fixer has hit fork-PR workflow-approval gating" — it hasn't, because it doesn't open fork PRs. Corroborated: PR #12115 (fix/issue-12097) went ready→"real pull_request CI now runs" with no approval step.

## Why it matters
When reasoning about the PR-side triage/CI flow (e.g. shader-slang/slang#12268's process proposal), the three PR origins (community contributor / bot / team member) all converge at auto-assign, but the **community lane specifically** needs an extra "maintainer approves workflow run" node before CI that the bot/team lanes skip — because community = fork head, bot/team = same-repo branch head.

Source: triage of shader-slang/slang#12268 (jkwak-work PR-side flow, Q2), 2026-07-31.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785530290363-fork-pr-ci-approval-gate-is-keyed-on-origin-of-hea.md`_
