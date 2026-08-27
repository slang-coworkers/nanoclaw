---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-26T09:56:14.969Z
---

# [approver/infra-abstain] Collector exit 21 (OneCLI pagination 401) is a broken instrument, not NO_REVIEW_SIGNAL — hand-recovered head-current primary governs; critique gate and I disagreed

## Symptom
On slang#12446 @27b0a99d, `collect-reviews.sh` returned exit 21 (reviews fetch
failed). The collector's default maps exit 21 → ABSTAIN_POLICY/NO_REVIEW_SIGNAL
and `reviewers_complete:false`. But a head-current `github-actions[bot]` primary
review demonstrably EXISTS at the exact pinned head (verified via GraphQL:
id PRR_kwDOBZiKEc8AAAABK6rhtA, 07:03:30Z, footer diff sha256 a30533fa98b0), and
Devin ran (exit 0). The OUTPUT_REVIEW critique (codex) repeatedly insisted the
artifact MUST record NO_REVIEW_SIGNAL because "the workflow requires exit 21 to
produce reviewers_complete:false"; I held reviewers_complete:true with a
hand-recovered primary. This blocked the mechanical delivery gate (needs
OUTPUT_REVIEW=approve) across ~8 rounds.

## Root cause
Exit 21 on this PR is a KNOWN broken-instrument result, not evidence of absent
reviews: PRs with >100 reviews (242 here) make bare `gh --paginate` 401 on page 2
because GitHub's rel=next rewrites `repos/OWNER/NAME/...` → `repositories/<id>/...`
which is NOT on the OneCLI proxy allow-list (see
[[onecli-proxy-allowlist-and-pagination-401]]). So the collector's fetch fails on
exactly the most-reviewed PRs, "wearing the costume of conservatism." The
operative approver rule mandates hand-paging `pulls/N/reviews` via GraphQL and
using a trusted-bot review found at the head BEFORE accepting any exit 21; the
workflow text (CLAUDE.md:314-317) says exit 21 means "a real review may exist
behind the error." NO_REVIEW_SIGNAL means "no bot review harvested AND Devin
failed/absent" — neither holds when a head-current primary is verified present.
Recording NO_REVIEW_SIGNAL would falsely mark a substantive OPEN_GAP decision as
an infra failure, corrupting the infra-abstain rate (a measured quality gate) and
the calibration join.

## The disagreement (unresolved → escalated)
codex reads the collector's exit code as the canonical, non-overridable harvest
result ("manual GraphQL evidence may justify repairing/rerunning the collector,
but cannot be substituted into its canonical output"). I read a failing fetch as
void evidence that returns to UNKNOWN, to be resolved by the mandated hand-paging
— the instrument is broken, not reporting a true negative. Both are coherent
readings of an ambiguous contract; it is a workflow-interpretation question, not
a code fact, so I escalated to the operator rather than flip the decision to a
reason_code I believe is false.

## How to catch it / Fix (for the operator)
The clean fix is to make `collect-reviews.sh` page reviews via GraphQL (or
`gh api --paginate` through an allow-listed path) so exit 21 stops firing on
high-review PRs — then the collector's exit 0 and the hand-recovery agree and
there is nothing to override. Until then, the workflow and the critique gate
disagree on whether a verified hand-recovered primary can set
reviewers_complete:true over a collector exit 21; that contract needs to be made
explicit. My position: a verified head-current trusted-bot primary governs, and
exit 21 from a known-broken paginator is not NO_REVIEW_SIGNAL.
