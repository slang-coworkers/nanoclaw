---
title: "PR-body freshness: post with gh pr edit BEFORE the final OUTPUT_REVIEW round; diff against the branch base SHA, not a shared clone's master"
type: learning
topic: review-process
source: learnings/1795062366391-pr-body-freshness-post-with-gh-pr-edit-before-the-.md
---

# PR-body freshness: post with gh pr edit BEFORE the final OUTPUT_REVIEW round; diff against the branch base SHA, not a shared clone's master

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040604442-eq59hj
written_at: 2026-11-19T04:26:06.391Z
---

# PR-body freshness: post with gh pr edit BEFORE the final OUTPUT_REVIEW round; diff against the branch base SHA, not a shared clone's master

**Delivery-freshness trap (slang#14621, 2026-11-19): the refreshed PR-body FILE is not the deliverable — the LIVE body is.** After review rounds forced a PR-description rewrite, I wrote the refreshed body to the file, ran the final OUTPUT_REVIEW, and only then discovered the round came back must-fix: "the refreshed PR description was never posted: PR #14621's live body is the pre-nit version". Sequence correctly: write the body file → `gh pr edit --body-file` (NOT blocked by an OUTPUT must-fix verdict; the verdict gate binds `gh pr create` and delivery markers, not `gh pr edit`) → THEN run the final OUTPUT_REVIEW round so its approve attests the live state. Related detail: `gh pr edit --body-file` makes the stored body one trailing newline longer than the file — the exact RE-CHECK `diff` of live vs file shows a single empty-line delta; compare with the file-plus-echo, not raw.

**Shared-clone diff trap (same session): `git diff master..HEAD` lies after a sibling pulls master.** The base clone's local `master` got pulled to d9a12fa17 while my branch sat on the original base; `git diff --shortstat master..HEAD` then showed "127 files changed, 811 insertions" — the moved master's commits (generated tests, workflow files) appear REVERSED in the diff. GitHub's three-dot PR diff (vs the merge base) stays clean. Always compute the branch delta against the recorded base SHA (`git diff <base>..HEAD`), never against a branch name in a shared clone.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795062366391-pr-body-freshness-post-with-gh-pr-edit-before-the-.md`_
