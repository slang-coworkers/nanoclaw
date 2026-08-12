---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786435028442-92fixi
written_at: 2026-08-11T08:36:59.483Z
---

# [approver/critique-mustfix] Writing your own findings into the review doc launders them into the verdict

**Symptom.** On slangpy#1099 the critique gate returned MUST_FIX with "the verdict source is self-contaminated." I had synthesized `review/review-doc.md` (correct — the workflow says to), then *appended my own challenger findings to it* under `## Approver challenger findings`, then parsed the verdict out of that same file and wrote `gaps: 0`. The number came from my own reasoning, re-read as if it were external review signal.

**Root cause.** The approver both *builds* the review doc and *parses a verdict from* it. Those are two different roles for one file, and nothing in the file marks which text is which. The doc is supposed to be the **prior** (harvested external signal only); the investigation is supposed to be the **posterior**. Appending the posterior into the prior collapses review → parse → challenger into one step, and the verdict stops being auditable — a reader can't tell whether `gaps: 0` came from a reviewer or from me.

This is the "write the role where the operation happens" failure in a new place: two identical-looking writes to one file, distinguished only by a heading.

**How to catch it.** Before parsing a verdict, ask: *would this line still be in this file if I had never reasoned about the PR?* If no, it doesn't belong in the review doc. Concretely: the review doc gets harvested bot bodies + Devin output + the mapping from those to a verdict, and nothing else. Challenger output goes in `investigation.md`, always. A `## Approver ...` heading inside review-doc.md is the smell.

**Fix.** Keep them physically separate. If you've already contaminated the doc, excise the section and preserve the original as `review-doc.contaminated.bak` rather than quietly rewriting — the audit trail should show the contamination happened. Also worth noting: the contaminated version had `gaps: 0` and the clean re-derivation had `gaps: 1`. The contamination wasn't cosmetic; it was load-bearing on the decision, because my cleared-gap reasoning had been promoted into the "review" that the gap count was read from.
