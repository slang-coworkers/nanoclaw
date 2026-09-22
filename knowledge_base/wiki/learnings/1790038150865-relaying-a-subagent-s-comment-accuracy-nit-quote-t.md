---
title: "Relaying a subagent's comment-accuracy nit: quote the committed comment, not the subagent's paraphrase of it"
type: learning
topic: misc
source: learnings/1790038150865-relaying-a-subagent-s-comment-accuracy-nit-quote-t.md
---

# Relaying a subagent's comment-accuracy nit: quote the committed comment, not the subagent's paraphrase of it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1785935169470-plpq2f
written_at: 2026-09-22T00:49:10.865Z
---

# Relaying a subagent's comment-accuracy nit: quote the committed comment, not the subagent's paraphrase of it

On slang-rhi#812 I passed a fixer a nit that a code comment "oversells — it claims a later call would return a valid zero handle." The fixer corrected me: the committed comment actually reads "does not leave an empty cache entry behind" — which is accurate. The "valid zero handle" phrasing was my review subagent's *characterization of the failure mode it was reasoning about*, not a quote from the comment. I relayed the subagent's paraphrase as if it were the comment's claim.

The trap is specific to **comment-accuracy / "the comment oversells" findings**: the finding is a claim about what the comment *says*, so verifying it requires quoting the committed comment text and checking the subagent's characterization against it. I did verify the underlying *mechanism* (`DescriptorHandle::operator bool()` tests `type != Undefined`, so a failed default-insert is falsy and retried) — that part was right — but I never checked that the comment made the claim the subagent attributed to it. A correct mechanism analysis attached to a misquoted target still produces a wrong nit.

Rule: before shipping any "this comment/message claims X and X is wrong" finding — mine or a subagent's — paste the exact committed text and confirm it actually says X. This is the [[dont-inherit-another-tiers-unobserved-failure]] rule applied to the *quote* rather than the *conclusion*: verify hedges, novelty, corrections AND the literal wording a finding is about. Low-stakes here (a withdrawn nit on a 0-must-fix PR), but it's the same shape that makes a confident-but-mistargeted claim survive review.

Bonus, resolved favorably by the same message: my "hosted-CI coverage of the rejection tests is doubtful (lavapipe may lack Shared/bindless)" uncertainty was closed by the run log — the rejection tests PASSED on the Linux gcc lavapipe *hosted* cells, so lavapipe does support enough. When you flag something as UNCERTAIN because you can't retrieve the evidence, that's correct discipline — and it lets the party who *can* retrieve it close the gap cleanly, which is exactly what happened.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790038150865-relaying-a-subagent-s-comment-accuracy-nit-quote-t.md`_
