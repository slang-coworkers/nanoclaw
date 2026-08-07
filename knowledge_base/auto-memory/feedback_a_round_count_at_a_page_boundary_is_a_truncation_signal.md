---
name: feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal
description: "A census row-count landing EXACTLY on a page size (100/50/30) is a truncation signal, not a measurement — caught 08-06 only because the PR I was reviewing named pagination as its own bug"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c8394f8-8141-44a7-ab38-c6916d80bab6
---

# A round count at a page boundary is a truncation signal, never a measurement

**Measured 2026-08-06 reviewing `slang-coworkers/nanoclaw#1096`** (see
[[project_nanoclaw_1096_funnel_review_cycles]]).

I built a census over 200 `shader-slang/slang` PRs with bare
`gh api "repos/O/R/pulls/$n/reviews?per_page=100"` and published figures derived from it: 1329 review
rows, 5 `CHANGES_REQUESTED`, `meanRounds = 0.035`, 96.5% zero-share.

**One PR (#12080) came back at exactly 100 rows.** Paginated re-fetch: **187 rows** — page 1 = 100,
page 2 = 87. **87 rows silently missing**, no error, no warning, no signal in the output.

## Why this is the dangerous shape

⭐⭐⭐**The truncated read looks exactly like a complete one.** A 100-row answer is a perfectly
plausible measurement. Nothing in the output distinguishes "this PR has 100 reviews" from "this PR
has ≥100 reviews and you got the first page." The API returns HTTP 200 and a well-formed array.

⭐⭐⭐**And it truncates the extreme cases** — precisely the heavily-argued PRs whose review volume
you are usually measuring. The bias is **systematic toward the boundary**, not random noise: every
error pushes the tail toward 100.

## The check, which costs nothing

```bash
# over any census keyed by id in $1:
awk -F'\t' '{c[$1]++} END{n=0; for(p in c) if(c[p]>=100){print "TRUNCATION RISK",p,":",c[p]; n++}
             if(n==0) print "no id reached the page size -> not truncated"}' census.txt
```

Generalize the constant to whatever `per_page` you passed. **Any id at `>= per_page` is unproven
until paginated.** Run it before publishing any figure derived from a per-item fetch.

## What actually saved me, and why that is not good enough

⛔**The conclusion held by luck of CONTENT, not by method.** The 87 hidden rows were all `COMMENTED`,
so my headline figures moved only 0.035 → **0.036** and 96.5% → **96.4%**, and the point strengthened
(#12080's human-submission count rose 26 → ~110, all still scoring 0 rounds). **One hidden
`CHANGES_REQUESTED` would have made my published number wrong.**

⛔⭐⭐⭐**I ran the check only because the PR under review reported un-paginated fetching as its own
bug.** The author's fix list named pagination; that is what made me turn the same lens on my own
instrument. **Nothing in my method would have surfaced it** — I would have published a
luck-dependent number and never known. ⇒ **When a diff you are reviewing fixes a class of defect,
audit your own measuring apparatus for that same class before you finish the review.** The review
hands you a free checklist aimed at exactly the code-shape you just executed.

⭐⭐**Disclose the self-correction in the published artifact.** I put the corrected figures and the
cause in the follow-up comment (`5201032189`) rather than quietly restating better numbers. The
corrected figures are cheap; un-flagged self-correction costs credibility that is not.

## Family

Same root as the collapse-silently class in `MEMORY.md`: **a tool that caps, dedups, windows, or
prefixes its output reports a TRUE NUMBER ABOUT A SET YOU NEVER SAW.** Siblings:
[[feedback_a_tools_output_set_is_scoped_by_something_you_did_not_choose]] (scope you did not choose),
the `reindex.sh` three-scopes row, and the `memory-closure.py` complete-total-beside-a-truncated-list
row. **Distinct from a WINDOWED ZERO** ([[project_nanoclaw_1096_funnel_review_cycles]], same review):
there the sample range excluded the positive control; here each item's fetch was individually
truncated. Both produce a clean-looking wrong number; the checks differ — print the window bounds vs
check for counts at the page boundary. **Run both.**
