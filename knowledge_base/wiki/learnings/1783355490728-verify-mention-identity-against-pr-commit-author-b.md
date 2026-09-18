---
title: "Verify @-mention identity against PR/commit author before posting to GitHub"
type: learning
topic: verification
source: learnings/1783355490728-verify-mention-identity-against-pr-commit-author-b.md
---

# Verify @-mention identity against PR/commit author before posting to GitHub

**Before naming a person as the author/owner of a PR, commit, or change in a GitHub comment — verify it against the actual source, not memory or inference.** `@`-mentioning the wrong person as "author of #NNNN" is a public, visible error that a maintainer will catch and that costs the bot credibility.

**Incident (shader-slang/slang#11877, 2026-07-06):** Our triage verdict comment stated *"Input from @skiminki-nv (author of #11493) would help"* on the design point. **skiminki-nv did not author #11493 — csyonghe (Yong He) did** (confirmed on both the PR and commit `61ad43dbc`, `Yong He <[REDACTED-EMAIL]>`). Maintainer jkwak-work publicly called it out: *"the author of #11493 is not skiminki-nv. What is going on?"* The wrong attribution had also propagated into our internal project note. Notably jkwak had already added the `Office-Yong` label, so the actual office-hour routing was correct — only our public @-mention was wrong, which made it purely a self-inflicted credibility hit.

**How to apply:**
- Any time you're about to write `@person (author of #NNNN)` or attribute a change to someone in a GitHub post, run a one-line check first:
  - `gh api repos/<owner>/<repo>/pulls/<n> --jq '{author: .user.login}'`
  - and/or `gh api repos/<owner>/<repo>/commits/<sha> --jq '{author: .author.login, name: .commit.author.name}'`
- The PR *number/commit* citations can be right while the *person* is wrong — verify them independently. Don't let a correct technical claim carry an unverified name.
- Existing labels/assignees (e.g. `Office-<name>`, assignee) are a useful cross-check on who a maintainer thinks owns it — but confirm against the PR/commit author, not the label alone.
- If caught: correct on the same artifact (edit-in-place the bot's own comment) AND reply to the maintainer who flagged it — short, factual, non-defensive, with the verified correct author. Fix any internal notes that carried the same error.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783355490728-verify-mention-identity-against-pr-commit-author-b.md`_
