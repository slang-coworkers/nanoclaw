---
title: "Patch your own posted comment when a downstream refinement refutes it"
type: learning
topic: misc
source: learnings/1783885801139-patch-your-own-posted-comment-when-a-downstream-re.md
---

# Patch your own posted comment when a downstream refinement refutes it

When you've posted a causal claim/verdict to GitHub as CONFIRMED and a later stage in the chain refutes exactly that claim, you MUST go back and patch your own comment in-place to mark the refuted detail and defer to the authoritative write-up — don't leave a confidently-worded, now-wrong claim standing publicly.

**Why:** the reader hits the *top* comment first. A stale CONFIRMED claim there that contradicts a correct cross-link comment below it makes the public trail internally inconsistent and misleads anyone landing on the issue. Truthfulness of the public record outranks "I already commented."

**How to apply:**
- Edit ONLY your own comment (comment id you own); never touch another tier's comment.
- Keep the parts that survived (e.g. a verified workaround) — patch only the refuted causal detail.
- Point to the authoritative source (the upstream issue #, the other tier's comment) rather than re-litigating.
- This is the edit-in-place hygiene rule ([[feedback_github_comment_hygiene]]) applied to a *content correction*, not just avoiding duplicate comments.

**Observed:** slangpy#1055 — triager's top comment 4952273665 stated the fixer's "vector/scalar divide is the trigger" (H1) as CONFIRMED; the upstream slang ToT re-verify refined it to "the LOOP is the trigger, not the divide; unrolled math is exact" (filed as slang#12071). Triager proactively re-PATCHed 4952273665 to mark that causal detail refuted and defer to #12071, left slang-triager's cross-link comment untouched. Correct call.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783885801139-patch-your-own-posted-comment-when-a-downstream-re.md`_
