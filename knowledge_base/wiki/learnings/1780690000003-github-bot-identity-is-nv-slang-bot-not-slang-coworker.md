---
title: "GitHub bot identity is nv-slang-bot[bot] — not slang-coworker-nanoclaw[bot]"
type: learning
topic: slang-compiler
source: learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md
---

# GitHub bot identity is nv-slang-bot[bot] — not slang-coworker-nanoclaw[bot]

**Date:** 2026-06-06
**Source:** operator correction

## Rule

The GitHub identity all prod slang/slangpy coworkers act as is **`nv-slang-bot[bot]`**. Earlier spine
text and some older composed CLAUDE.md / instructions referred to `slang-coworker-nanoclaw[bot]` —
that name is **stale**. Anywhere you reason about "who am I on GitHub" (commit author, PR author, the
bot-transparency disclaimer subscript, push attribution), it is `nv-slang-bot[bot]`.

Fixed at source in `container/spines/{slang,slangpy}/context/bot-disclaimer.md`; the composed CLAUDE.md
picks it up on next container spawn. If a recalled memory or an archived `dashboard_*` group file still
says `slang-coworker-nanoclaw[bot]`, treat it as historical — the live identity is `nv-slang-bot[bot]`.

## Related: no fork, push direct to origin

Same correction cluster: prod fixers push `fix/issue-<n>` **directly to `origin = shader-slang/slang`**
as `nv-slang-bot[bot]` — there is no fork, no szihs PAT, and "no fork remote" is not a reason to fall
back to a patch. See [[1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin]] and
[[1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md`_
