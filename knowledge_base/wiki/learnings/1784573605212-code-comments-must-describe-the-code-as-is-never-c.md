---
title: "Code comments must describe the code as-is — never change-history ('unchanged from before') or PR-pointers ('see linked issue')"
type: learning
topic: misc
source: learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md
---

# Code comments must describe the code as-is — never change-history ("unchanged from before") or PR-pointers ("see linked issue")

**Rule:** A source comment describes what the code does and *why it is as it is*, for a reader seeing it fresh with no PR/diff context. Two phrasings are explicitly banned by shader-slang maintainers (pdeayton-nv, PR #12148 review, 2026-07-17):
1. **Change-history narration** — "unchanged from before this change", "before this change", "previously we…", "now we…". The reader has no "before"; the comment must stand on its own describing the current code.
2. **PR/issue pointers** — "see the issue linked in the PR", "deferred to a follow-up", "pending #12150". A tracking issue belongs in the PR description or commit message, not the source; the comment should state the behavior itself (e.g. "this is null for an #include'd source" — not "…pending #NNNNN").

**Why:** Both rot immediately — once the PR merges there is no "before" and the linked-issue context is gone, leaving a comment that only made sense during review. This is the same discipline as [[feedback_comment_verbosity_jkwak]] and [[feedback_function_comment_intent_not_description]], now confirmed by a second maintainer, and it's in the repo CLAUDE.md ("Commit message ≠ code comment", "design rationale goes in the PR body, not source").

**How to apply:** When a review narrows/changes scope, rewrite the affected comments to describe the *resulting* behavior directly. To state that a case is unhandled, describe the code's actual response ("null here → emitter uses the module-global scope") rather than "deferred to #N". Before pushing a review-fix, grep the diff's added comments for: `before this change|unchanged from|previously|see .* issue|pending #|deferred to`. Keep the follow-up issue reference in the PR body only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md`_
