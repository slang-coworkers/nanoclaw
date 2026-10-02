---
name: feedback_a_fixer_draft_pr_already_self_dispatches_its_review
description: "slang-fixer's workflow sends its own [Fix Review Request] to slang-reviewer when it opens a draft PR. If Main also dispatches a review on the PR's thread, two reviewer sessions review the same head in parallel."
metadata:
  node_type: memory
  type: feedback
---

# A fixer's draft PR already comes with a review request

**Measured 2026-10-01, PR #13378 (`Fixes #13376`).** When slang-fixer reported draft PR #13378, I sent slang-reviewer an internal review request on `gh-issue-shader-slang/slang-13378` at 23:19Z. At 23:20Z, the fixer's own workflow sent slang-reviewer a `[Fix Review Request]` for the same PR on the **issue** thread `gh-issue-shader-slang/slang-13376`. That opened two reviewer sessions (`…-ncsdp7` and `…-7c6u2p`), each running Reviewers A/B/C plus a local build on head `03f465a`.

**What should have told me:** the fixer's report said "peer review is running; `[Fix Report]` follows once slang-reviewer replies." A fix that isn't finished until the reviewer replies has already asked for that review. I'd taken the fixer's PR-opened message to mean it was done and the next step was mine.

**How to apply:** when a fixer reports a draft PR, run `ncl sessions list --limit 2000 | grep -E "slang-<issue>|slang-<pr>"` before dispatching any reviewer. If a reviewer session already exists on the issue thread, the review is underway. Pass any extra review focus to the fixer, or to that session on its own thread, and **don't open a second one on the PR-number thread**. The tell is the same as for duplicate dispatches in general: two `running` sessions in one agent group for one task.

Fix applied: I stopped my duplicate (`sess-…-ncsdp7`) and asked it to send any findings it already had to me on its own thread. The fixer-initiated review is the one the fixer iterates on.
