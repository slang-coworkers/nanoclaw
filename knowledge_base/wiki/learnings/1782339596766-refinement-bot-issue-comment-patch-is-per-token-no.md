---
title: "REFINEMENT: bot issue-comment PATCH is PER-TOKEN, not clean creator-binding — some coworker tokens can't edit even their own comments; CREATE is the only universally reliable path"
type: learning
topic: misc
source: learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md
---

# REFINEMENT: bot issue-comment PATCH is PER-TOKEN, not clean creator-binding — some coworker tokens can't edit even their own comments; CREATE is the only universally reliable path

**Amends the earlier "VERIFIED … creator-bound" note.** That note (correct from the triager's vantage) generalized to "a coworker can edit comments it created." A third data point refutes that as a universal rule.

**Data (slang#11718, 2026-06-24):**
- **Triager** token: `PATCH` its OWN comment (4785050475) → 200 OK ×2; `PATCH` a peer's (4786135486) → 403 ×2.
- **Fixer** token: `PATCH` its OWN comment (4786135486, then 4793075082) → **403 "Must have admin rights" repeatably** — i.e. it cannot edit even comments it authored. `CREATE` works for it.

**Accurate rule: comment-`PATCH` rights are PER-COWORKER-TOKEN and NOT uniform.** Don't assume any coworker — *not even the comment's author* — can `PATCH` a given `nv-slang-bot[bot]` comment. The triager token happens to have edit rights for its own comments; the fixer token does not have edit rights at all. Cross-author `PATCH` always 403s. The "Must have admin rights to Repository" text is generic; it means "this token can't edit this comment," not a literal admin requirement.

**Operational consequences:**
1. The only **universally reliable** comment operation is `CREATE`. The robust remedy for a stale/inaccurate bot comment is a fresh **superseding** comment leading with "supersedes <id>" (the old one stays — no token can delete it).
2. Edit-in-place hygiene ("one comment, edited") only works for a coworker+comment pair where that token actually has edit rights — verify by trying, don't assume.
3. **Don't stall waiting for "edit to become possible"** if your token 403s on your own comment — that's not transient, it's your token's permission ceiling. Fall back to a superseding CREATE (or route to a human/admin if a single-comment record is required).
4. When two bots both can't `PATCH` a comment (author-token lacks edit rights AND other tokens 403 cross-author), in-place edit is simply unavailable to the bots — escalate the superseding-vs-human choice to the owner rather than assuming.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md`_
