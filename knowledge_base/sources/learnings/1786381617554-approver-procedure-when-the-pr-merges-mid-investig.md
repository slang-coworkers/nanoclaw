---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786379121026-lgq3jn
written_at: 2026-08-10T17:06:57.554Z
---

# [approver/procedure] When the PR merges mid-investigation, the merge is the LABEL — exclude it from the verdict and say so in the doc

# [approver/procedure] A PR that merges while you are investigating hands you the answer key — do not read it

## Symptom

Deciding slangpy#1097 (2026-08-10). I pinned head `9d502374c933`, ran clauses, harvested
CodeRabbit, and while I was chasing the challenger threads the PR **merged** at 16:53:40Z —
on the exact SHA I had pinned. My routine `gh pr view --json state` (run to check something
else entirely) returned `state: MERGED`.

The pull to "sanity-check" the verdict against that is strong, and it is *precisely* the
thing that destroys the measurement.

## Root cause of the hazard

Approver decisions are scored by joining against the human outcome, and per the skill
**merged ⇒ APPROVED-equivalent**. So the merge state IS the label the decision is graded on.
Consulting it before finalizing is textbook label leakage: an ABSTAIN would "round up" to
WOULD_APPROVE for reasons that have nothing to do with the evidence, and the agreement
number that results measures nothing. Worse, it is invisible after the fact — the ledger
row's headline fields (verdict, SHA) look completely normal either way.

Live-mode approvals race the humans by construction. Merge-during-investigation is not an
edge case; expect it on any fast-moving repo, especially small PRs from MEMBER authors.

## How to catch it

- Treat `state`/`mergedAt`/`mergeCommit` as **write-only until the verdict is fixed**. If a
  routine query returns them, note and quarantine them; don't reason from them.
- The tell that you already leaked: your rationale contains "and it merged anyway", "the
  maintainers were fine with it", or a gap you'd already verified as reachable suddenly
  reads as "evidently acceptable in practice."
- Ask: *would I still write this verdict if the PR were still open?* If no, the merge is
  doing the work, not the evidence.

## Fix

Put an explicit **label-leakage disclosure** in the review doc and the ledger `challenger`
field: the merge was observed, at what time/SHA, and that it was excluded from the
derivation with the reason. This makes the discipline auditable by the operator instead of
being a private claim about your own reasoning — the same move as writing an epistemic
label at the claim rather than trusting a caveat five paragraphs up.

Then use the merge for what it is legitimately for: the **calibration join afterwards**
(`record_human_verdict` where available, plus a learning), strictly downstream of the
recorded decision. Same datum, two roles; the ordering is the whole game.
