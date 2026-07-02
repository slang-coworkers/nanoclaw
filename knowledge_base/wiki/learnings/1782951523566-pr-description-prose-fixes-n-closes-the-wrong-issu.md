---
title: "PR-description prose fixes-N closes the wrong issue and blocks auto-close"
type: learning
topic: misc
source: learnings/1782951523566-pr-description-prose-fixes-n-closes-the-wrong-issu.md
---

# PR-description prose fixes-N closes the wrong issue and blocks auto-close

## Symptom
A merged PR did NOT auto-close its target issue (shader-slang/slang#11856), even though the squash **merge commit subject** was literally `Fix #11856: ...`. Maintainer had to close it manually and asked why.

## Root cause (verified via `gh pr view <pr> --json closingIssuesReferences`)
GitHub auto-closes issues on merge from the **linked issues it parsed out of the PR *description* (body)** via closing keywords (`fix/fixes/fixed`, `close/closes/closed`, `resolve/resolves/resolved` + `#N`). It does **NOT**:
- scan the PR **title** for closing keywords, and
- (for a PR merge) use the merge **commit subject** — even a `Fix #N` squash subject does nothing; merge auto-close uses the body-parsed `closingIssuesReferences`.

The PR body here had **no** `Closes #11856`. Its ONLY closing keyword was an incidental `fixes #11720` sitting inside a Motivation sentence *describing a different, earlier PR*: `PR #11785 ("...", fixes #11720)`. GitHub's linkifier can't tell that's descriptive prose, so it treated it as a closing reference **for this PR** → `closingIssuesReferences = [#11720]` (an unrelated, already-closed issue) → merging closed nothing new and the real issue stayed open.

## Rules
1. Put the literal `Closes #<this-issue>` (or `Fixes #<this-issue>`) in the PR **description body**, not just the title. The title/commit-subject `Fix #N` does not auto-close on a PR merge.
2. NEVER write `fixes #N` / `closes #N` / `resolves #N` in PR-body prose when you mean to *describe/reference* another PR or issue — GitHub will hijack it as a closing link for the current PR. Reference other issues/PRs as plain `#N` (e.g. write "PR #11785 (which addressed #11720)" not "PR #11785 (fixes #11720)").
3. After opening a PR, verify with `gh pr view <n> --json closingIssuesReferences` that the linked issue is the one you intend.

## Bonus gotcha
`gh issue close` is blocked by a PreToolUse hook for the bot account (issue-close is human-gated even when a post is authorized). If a maintainer asks the bot to close an issue, post the answer/comment and ask them to click close themselves.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782951523566-pr-description-prose-fixes-n-closes-the-wrong-issu.md`_
