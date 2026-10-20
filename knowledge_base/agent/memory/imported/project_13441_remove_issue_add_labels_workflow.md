---
name: project_13441_remove_issue_add_labels_workflow
description: "slang#13441 (jkwak-work, 10-05): delete .github/workflows/issue-add-labels.yml. TERMINAL 2026-10-19 — jkwak's own PR #13500 merged 10-08 (311a3d631), file + Dev Opened/Dev Reviewed labels gone; issue left open (not auto-linked). Bot did triage only, never a fixer."
metadata:
  node_type: memory
  type: project
---

**10-05 — issue_opened, routed to `slang-triager` on `gh-issue-shader-slang/slang-13441`.** Live read at
dispatch (16:5xZ): open, 0 comments, human author `jkwak-work`, assigned to jkwak-work (by jhelferty-nv
16:47:54Z), already labelled `Dev Opened` by the very workflow it asks to remove.

Pre-dispatch evidence (gh code search, default-branch index; triager to re-verify at HEAD):
- `issue-add-labels` is referenced only in `.github/workflows/README.md`.
- `SLANGBOT_ISSUES_WRITE` and `SLANGBOT_MEMBERS_READONLY` appear only in `issue-add-labels.yml`.
- No open PR touching it.

**Disposition:** triage verdict + the verified reference/secret inventory, then PARK. No fixer dispatch:
standing no-autofixer-jkwak-self-filed policy (no leaf for it in this store; precedents [project_12083](project_12083_licenses_dir_release_packages.md),
[project_12247](project_12247_slang_test_o3_spvopt_baseline.md)); `.github/workflows/**` is also outside what
the bot can push ([project_11806](project_11806_cmake_options_maintainer_selffix.md)). Label/secret deletion is
repo-admin work — never the bot's.

~~RESUME on a substantive human comment or when jkwak's own PR lands.~~ Superseded by the terminal entry below.

**10-05 17:06Z — triaged, PARKED.** Verdict comment
[5999261613](https://github.com/shader-slang/slang/issues/13441#issuecomment-5999261613) (nv-slang-bot, verified
live). Task / CI / low / P3, checked at master e6be8dcdd. Memo: `/workspace/inbox/a2a-1791220023922-h3xkub/triage-13441.md`.
- The only references are the workflow file and README.md:268. Each secret appears exactly once, in the
  workflow. An org-wide search for the secrets, the label and the filename finds only those 2 files.
  Nothing reads the `Dev Opened` label.
- The workflow is live: its last run succeeded at 16:49Z. The label is on about 1473 issues and 7 PRs.
- Premise nuance: "Source" is the Slang-All board field set by `issue-board-onboard.yml` (#12854), not
  a section of the issue template. Its roster is the `source-internal*` team family, which differs from the `dev` team.
- Recommended: Approach A, a 2-file PR to be pushed by a maintainer. Deleting the label (irreversible across about 1480 items)
  is jkwak's call. The bot can't see secret scope (repo vs org): the secrets API returns 403.

Re-chase task `rechase-13441-maintainer-*` fires 2026-10-19T17:00Z (dashboard-only report, no GitHub post).

**2026-10-19 17:00Z re-chase — TERMINAL.** Live read: jkwak-work's own PR
[#13500](https://github.com/shader-slang/slang/pull/13500) "Remove unused dev issue labeling workflow" was MERGED
2026-10-08T00:22Z (merge `311a3d631`). It deletes `.github/workflows/issue-add-labels.yml` (−61) and its
`README.md` line (−1), which is Approach A from the triage. Contents API 404s on the file at HEAD. The `Dev Opened` and `Dev Reviewed`
labels both 404 now. They were deleted, and the `unlabeled` event on #13441 at 10-08T01:17Z is attributed to jkwak-work. The PR body does not
reference #13441 (`closingIssuesReferences` is empty), so the issue is still **OPEN** with only the bot's triage
comment. Closing it is jkwak's call. Per the task: no GitHub post and no fixer dispatch. Chain closed. Reopen it
only if a human comments on #13441.
