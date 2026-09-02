---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787073715089-rgfdiu
written_at: 2026-09-01T14:35:22.768Z
---

# [approver/human-disagreement] CONFIRMED-SAFE: fallback-tier trivial-tooling PR with green self-CI + human LGTM merged unchanged over a refuted Devin 🔴 — the abstain was pure procedural over-caution

## Outcome join
shader-slang/slang PR #12600 ("Invoke the markdown formatting stage in
default/--modified runs") MERGED by jkiviluoto-nv at a925f6fa0da0 — the exact
commit of my r2 ABSTAIN_POLICY/CHALLENGER_CONCERN decision. No follow-up commits
between my decision and the merge: the change shipped byte-identical to what I
reviewed. My merits read ("change is safe; Devin's 🔴 is a false alarm") was
vindicated. (ABSTAIN rows are excluded from agreement scoring, but the merge is
the strongest calibration signal, so recording it.)

## The transferable shape (sharpens Step-0 recall)
A PR is a HIGH-CONFIDENCE false-alarm abstain — safe, will merge unchanged — when
ALL of:
1. Source is FALLBACK tier (production github-actions[bot] review skipped; harvest
   exit 20) — so the only "review" signals are CodeRabbit + Devin.
2. The change is trivial dev-tooling (here: a 1-line formatting-dispatch guard
   `((run_markdown))` → `((run_all || run_markdown))` matching 5 sibling stages) +
   mechanical formatting churn.
3. The PR's OWN activated check is GREEN on the pinned head — i.e. the positive
   control that could have failed (and did on the prior revision) now passes.
4. A human has already LGTM'd (even if stale-dismissed by a later formatting push;
   check the review_dismissed event: dismissed_review_state=approved + no message
   = mechanical, not a retraction).
5. The only blocking signal is a Devin 🔴 you REFUTED against that same green CI.

When you see this exact conjunction, you are still procedure-bound to ABSTAIN (the
challenger cannot clear a fallback 🔴 to approve), but you can state with high
confidence it will merge unchanged — and it did here.

## Cost note for the policy owner
This is the recurring cost of the fallback tier: a single Devin false-🔴 on an
otherwise-pristine, human-approved, green-CI trivial PR forces an abstain a human
must clear. If fallback-tier trivial-tooling PRs with green self-CI + human LGTM
keep merging unchanged over refuted Devin 🔴s, that is evidence for a narrow
policy carve-out (or for treating Devin flags on non-code/tooling diffs as
advisory, not blocking) — measure the rate before proposing it.
