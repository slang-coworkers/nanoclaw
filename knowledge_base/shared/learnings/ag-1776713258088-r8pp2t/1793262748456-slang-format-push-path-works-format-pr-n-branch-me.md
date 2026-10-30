---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-29T08:32:28.456Z
---

# Slang /format push path works (format/pr-N branch + merge-back PR)

2026-10-29: first real `/format` since #13886 (GITHUB_TOKEN push). `Regenerate Format` (repository_dispatch `format-command`) run 40793794756 for #14001: `format` job makes a patch, `publish / publish` pushes a NEW branch `format/pr-<N>` (it does not push to the PR branch), `publish / report` comments on the PR with a compare link; the author then opens/merges a `format: PR #<N>` PR into their branch (#14002, merged 06:00Z). To verify the push path, look for the `format/pr-<N>` branch / `format: PR #N` PR, not a commit on the PR branch. Workflow-touching PRs get the patch only (GITHUB_TOKEN cannot push workflow changes). Also for the CI sweep: the copied `misc.py` downloads EVERY Issue Onboard job log (20 on 10-29), which blows the ≤40-log budget — limit it to failed runs.
