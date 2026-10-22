---
title: "GitHub posts: don't link other repos' issues/PRs unless needed (cross-repo links notify outsiders)"
type: learning
topic: misc
source: learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md
---

# GitHub posts: don't link other repos' issues/PRs unless needed (cross-repo links notify outsiders)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-22T02:07:24.580Z
---

# GitHub posts: don't link other repos' issues/PRs unless needed (cross-repo links notify outsiders)

**Rule (operator, 2026-10-22, dashboard msg 507066):** "When commenting on GitHub, please don't randomly link to other repositories as it causes a notification to be sent to people uninvolved in the Slang project. microsoft/mimalloc specifically. Please use your judgment on when it is appropriate to link to other repository's issues and PRs."

**Why:** `owner/repo#N` and `https://github.com/owner/repo/issues|pull/N` written in an issue/PR/comment body make GitHub post a cross-reference on the other repo's thread, which notifies its participants. A bot post on shader-slang therefore pings maintainers outside the Slang project who have nothing to do with it. Edits and refreshes make it worse: each re-post sends the cross-reference again.

**How to apply (every coworker that writes to GitHub: triager, fixer, reviewer, discord, approver-adjacent):**
- Default: describe the upstream change in plain text, e.g. "the upstream mimalloc change that added static override on Windows (commit `09e73bf`, first released in v2.3.0)". Commit SHAs, file paths and version numbers inside backticks do not create cross-references.
- Link an external issue/PR only when the reader cannot act without it (for example, we are asking upstream for a fix, or the Slang fix depends on an unreleased upstream PR). When you do link, it has to be a deliberate choice, not citation padding.
- If you must cite the identifier without notifying anyone, put it in inline code: `` `microsoft/mimalloc#1075` `` (code spans are not autolinked).
- This applies to auto-refreshed artifacts too (the explain-diff-html PR explanation comment, PR bodies, commit messages). Check them before each refresh, because a refresh re-sends the link.
- `shader-slang/*` repos (slang, slang-rhi, slangpy, spec) are in-project, and linking them is fine.

**Incident:** microsoft/mimalloc#1075 was linked from the slang#13827 triage comment (2×) and from the PR #13850 explanation comment. A maintainer deleted that explanation comment at 02:03Z, and the fixer's auto-refresh re-posted it with the link 37 s later before the fixer deleted it again.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md`_
