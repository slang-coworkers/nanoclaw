---
type: chain
title: slang#14427 — investigate moving CI workflows off pull_request_target
description: Maintainer-filed (jhelferty-nv) 2026-11-09 19:52Z. CI/infra investigation, not a compiler bug. Self-assigned plus jkiviluoto-nv 2 s after filing. HELD under rung 4: no dispatch, no bot post.
tags: [ci, github-actions, pull_request_target, held]
---

# slang#14427 — move CI workflows off `pull_request_target`

**2026-11-09 19:52Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels.
Author jhelferty-nv. `assigned` events at 19:52:30Z: jhelferty-nv (self) and jkiviluoto-nv
(assigner jhelferty-nv). The only session on `gh-issue-shader-slang/slang-14427` is this Main
webhook session (`qjrgwj`). No task.

**What it asks.** GitHub's default Actions policy will block `pull_request_target` in public repos
from **2026-12-02**. A brownout on 11-09 16:21–18:00Z made every such workflow fail with
`startup_failure`, so the required "SlangPy Tests" status was never posted (e.g. #14351). The
short-term fix is an admin allow policy. The issue asks for each workflow to be migrated (for
example a `pull_request` → `workflow_run` pair, as in `pr-review-fork-bridge.yml`/`-apply.yml`) or
for the reason it keeps `pull_request_target` to be documented. Affected workflows:
`ci-slangpy-trigger-test.yml`, `claude-pr-review.yml`, `pr-maintenance.yml` (→
`pr-board-sync.yml`), `slash-cleanup.yml`.

**Why held.** Rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md).
It is a maintainer-written plan with maintainer assignees, and the fix needs repo-admin and
workflow-policy decisions.

**Fleet note.** PRs whose "SlangPy Tests" status is missing from the 11-09 16:21–18:00Z window
show an infra `startup_failure`, not a code failure.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.

**2026-11-10 06:42Z, `pr_mention` (comment 6760933971, jkiviluoto-nv, MEMBER).** I read the live body. It
starts "My recommendation…" and has no `@` mention at all, so no mention was stripped. It is not a
summons (rung 5): hold, no dispatch, no reaction, no post. The assignee's assessment: add a scoped
`pull_request_target` exception before 12-02 (a read-only check on 11-10 found no repo or inherited
Actions policy). Then migrate `slash-cleanup.yml` to a scheduled sweep first. Keep
`ci-slangpy-trigger-test.yml`, `claude-pr-review.yml` and `pr-maintenance.yml`/`pr-board-sync.yml`
for now, and pilot a dedicated SlangPy `pull_request` → `workflow_run` relay only if removing the
event stays the goal. Labeled `CI` 11-09 19:58Z by jhelferty-nv. Still HELD.
