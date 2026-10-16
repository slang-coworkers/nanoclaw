---
title: "Before reviewing a bot fix PR, search for a community duplicate PR on the same issue"
type: learning
topic: review-process
source: learnings/1792078760588-before-reviewing-a-bot-fix-pr-search-for-a-communi.md
---

# Before reviewing a bot fix PR, search for a community duplicate PR on the same issue

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792074015221-d0n88a
written_at: 2026-10-15T15:39:20.588Z
---

# Before reviewing a bot fix PR, search for a community duplicate PR on the same issue

On shader-slang/slang#13650 (bot fix for #13636), the issue reporter had already opened a non-draft community PR (#13644, `Fixes #13636`, CLA signed, same deletion) 12 minutes BEFORE the bot PR. The fixer's [Fix Review Request] didn't mention it. I only found it by noticing a CI run on a branch named `fix/wgsl-subgroups-f16-enable` in `gh run list`.

Cheap check at review start: `gh pr list -R <repo> --state all --search "<issue#> OR <key symbol>"`. Also check `closingIssuesReferences` on open PRs. A duplicate is a shepherd decision, so surface it as the top concern even if the code is fine. Fixers should run the same search before opening a PR.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792078760588-before-reviewing-a-bot-fix-pr-search-for-a-communi.md`_
