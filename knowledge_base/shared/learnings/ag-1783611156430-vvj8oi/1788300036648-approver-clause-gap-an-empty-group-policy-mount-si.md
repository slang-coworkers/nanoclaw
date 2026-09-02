---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-09-01T22:00:36.648Z
---

# [approver/clause-gap] An empty group policy mount silently downgrades a substantive OPEN_GAP to a bare eligibility CLAUSE_FAIL — the fallback isn't just "conservative", it discards the more-informative signal

## Symptom

Re-gating slang#12452 at a new head (R3), `eval-clauses.py` reported
`policy v0-shadow` and FAILed `head_provenance` on this fork PR — despite R1/R2
(weeks earlier) running under `v0-shadow-wide` with `allow_fork_head:true` and
abstaining on *challenger* grounds (`OPEN_GAP`, address identity).

Root cause: the group mount `/workspace/extra/approver-policy/` is **empty** on this
container (no `APPROVAL_POLICY.json`), so the script falls to its bundled `v0-shadow`
default (`allow_fork_head:false`). Verified `ls` of the mount dir: two entries, no
policy file. Same condition sibling Sep-1 decisions hit (#12186 R2, #12538 R2, #12819).

## Why this is worth its own note beyond the sibling learnings

The sibling rows framed the empty-mount fallback as "conservative, no outcome change"
— true for them, because those were already abstaining or the stricter policy only
tightened an eligibility they'd have failed anyway. **On #12452 it is materially worse:
it changed the decision's *reason and information content*.**

- Under `v0-shadow-wide`: `ABSTAIN_POLICY:OPEN_GAP` — a code-relevant finding (out-of-tree
  address-identity source-compat on a public header), the product of real challenger
  work, useful to the human weighing the merge.
- Under bundled `v0-shadow`: `ABSTAIN_POLICY:CLAUSE_FAIL:head_provenance` — a bare
  eligibility gate that early-returns *before* the challenger runs, carrying zero code
  judgment.

Both are `ABSTAIN_POLICY`, so a "did the outcome flip?" check says no. But the reason_code
and the signal to the human are different, and the early-return would have **discarded the
substantive finding entirely** if I'd let it. The outcome-direction test is too coarse to
catch this.

## How to catch / handle it

1. **Read `clauses.json`'s `policy_version` every run and compare to the prior revision's.**
   A `v0-shadow` where a prior revision used `v0-shadow-wide` is the tell. (Distinct from
   the *other* policy trap — a mis-staged per-PR `work/…/policy/` overriding the mount;
   here the mount is simply empty. Check both: `ls <ws>/policy` AND `ls the mount`.)
2. **When an eligibility CLAUSE_FAIL early-returns but you hold a substantive finding from
   a byte-identical prior revision, carry the finding as human-facing context** in the
   decision doc rather than letting the early-return bury it. State the decision under the
   policy actually in effect, and state what it would be under the group's intended policy.
3. **Decide under the policy that is actually loaded, not the one you wish were mounted** —
   but flag the empty mount as a provisioning concern to the orchestrator, because it is
   degrading every fork-PR decision this run to the bundled default.

## The transferable rule

**"Same outcome" is not "same decision."** A policy fallback can preserve the
ABSTAIN/BLOCK/APPROVE bucket while swapping the reason_code from a substantive one to a
procedural one — and reason_code is what the human and the agreement-scoring join actually
read. When policy resolution changes between revisions, the diff to check is the
reason_code and the evidence behind it, not just the enum bucket.
