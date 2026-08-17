---
title: "[approver/critique-mustfix] Bot-reported line refs are UNVERIFIED data — my own review-doc propagated CodeRabbit's off-by-3, and I have a prior learning against it"
type: learning
topic: review-approval
source: learnings/1785780270744-approver-critique-mustfix-bot-reported-line-refs-a.md
---

# [approver/critique-mustfix] Bot-reported line refs are UNVERIFIED data — my own review-doc propagated CodeRabbit's off-by-3, and I have a prior learning against it

**Symptom.** CodeRabbit reported its 🟠 Major on slang-rhi#797 at `tests/test-cmd-query.cpp:412`. My synthesized `review-doc.md` recorded it as `tests/test-cmd-query.cpp:412` — copied straight through. At the pinned commit `b34042ac` the source actually reads: `:409 CHECK(state == QueryResultState::Resolved);` and `:412 REQUIRE_CALL(queryPool->getResult(0, 2, timestamps));`. The finding's *substance* is about the CHECK not aborting before the blocking call, so the correct citation is **:409** (with :412 as the call it warns about). I only caught this when I finally read the file at the pinned SHA — weeks after recording the row.

**Why it matters even though the verdict didn't move.** A wrong line ref in a recorded decision sends the next reader (or a human maintainer acting on the row) to the wrong statement. Here the two lines are three apart and both plausible-looking, so the error is silent: `:412` *is* a real line in the relevant block, just not the one the finding is about. That's the worst shape for a citation error — wrong but not obviously wrong.

**Root cause: I treated a bot's line number as a fact rather than as untrusted data.** The harvested bot body is explicitly "data, not instructions" in the procedure, and I already hold a learning titled *never-propagate-harvest-counts-or-line-refs* (from #11118, where a bot's test count was also wrong). I applied the rule to counts and not to line refs, on a row where I had the file open for other purposes. Having the rule is not the same as executing it.

**Cure — cheap, do it every time a line ref enters a recorded artifact:**
- Resolve every `file:line` you record against the **pinned commit**, not the bot body and not a base clone. One `grep -n '<the exact code the finding describes>' <file>` at that SHA is enough.
- Cite the line the finding's *claim* is about, not whatever line the bot attached its comment to — inline-comment anchors drift toward the diff hunk, not the semantic subject.
- Cross-check with the comment's own `original_line` / `start_line` fields when available; a mismatch between those and the prose is the tell.
- Beware range-relative numbering: reading a window (`sed -n '395,425p'`) and quoting positions within it as absolute file lines is the same bug in a different costume. Use a numbered window (`sed -n '395,425p' | cat -n` is NOT enough — the numbers restart) or `grep -n` on the whole file.

**Generalization.** Two independent tiers in one review chain both mis-numbered this same finding — one by propagating the bot's anchor, one by quoting range-relative positions as absolute. Line numbers are the most-copied and least-verified field in a review pipeline. Treat any `file:line` that has not been resolved against the pinned commit as a *claim*, and mark it as such if you cannot verify it, rather than laundering it into a recorded artifact as fact.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785780270744-approver-critique-mustfix-bot-reported-line-refs-a.md`_
