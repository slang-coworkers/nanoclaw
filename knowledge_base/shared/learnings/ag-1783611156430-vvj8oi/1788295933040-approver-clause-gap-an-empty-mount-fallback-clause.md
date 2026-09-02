---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787744396186-8c7g93
written_at: 2026-09-01T20:52:13.040Z
---

# [approver/clause-gap] An empty-mount fallback CLAUSE_FAIL is POLICY, not infra — and read operations/ standing-state BEFORE deciding

## Symptom
Re-gating slang#12446 (R12) under a `synchronize`, eval-clauses reported policy `v0-shadow` (bundled default) instead of the `v0-shadow-wide` that governed R1–R11, and two clauses now FAILED — `head_provenance` (fork head) + `tier_eligible` (3867>400). I initially recorded `ABSTAIN_POLICY / HARNESS_FAIL:policy_mount_missing` (infra), reasoning by analogy to the exit-21 false-abstain ("an infra regression producing a result in the costume of a legitimate conservative outcome"). Codex (which had read the standing operations note) flagged it must-fix; the correct code is `CLAUSE_FAIL:head_provenance` (policy).

## Root cause
The group-mounted approver policy `/workspace/extra/approver-policy/APPROVAL_POLICY.json` is empty → eval-clauses falls back to the bundled conservative `v0-shadow` (allow_fork_head:false). This is a KNOWN standing state with an explicit orchestrator instruction (memory `operations/approver-policy-mount.md`): record honest `ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance`, do NOT re-escalate per-PR (one consolidated standing escalation is already open), wait for the relayed operator ruling.

## Why the exit-21 analogy is WRONG here (the key disanalogy)
- exit-21: a FETCH DEFECT hides *recoverable real data* (a head-current primary review that exists and is GraphQL-pageable). Accepting the defect's output (NO_REVIEW_SIGNAL) discards real signal → correctly treated as infra/false-abstain; hand-recover it.
- empty-mount fallback: the bundled default IS a present, coherent policy. Nothing is hidden; the clause evaluates cleanly against a real policy. So it is a legitimate POLICY `CLAUSE_FAIL`, not infra. Mislabeling it infra corrupts the policy-vs-infra gate metric and duplicates an escalation.
Test to tell them apart: "Is there real, recoverable signal being suppressed by a defect (→ infra, recover it), or did a coherent-but-narrower policy/input legitimately produce this result (→ policy CLAUSE_FAIL)?"

## How to catch it
1. Do Step 0 recall / read `memory/operations/*` FIRST every session — standing-state notes (empty mount, known-affected PRs) resolve reason_code and escalation up front. Skipping it caused the mis-code. The memory tree may be reorganized (operations/ vs imported/); check operations/.
2. A surprising `head_provenance`/`tier_eligible`/`author_trust` FAIL on a PR that passed before is usually a POLICY-SOURCE FLIP (mount emptied → bundled default), not a code change — confirm the effective policy_version in clauses.json.
3. Record AFTER the critique gate even for ABSTAIN: the skill says ABSTAIN records immediately, but the mechanical delivery gate still forces a DECISION_REVIEW, and that critique changed my reason_code AFTER the append-only record_decision write (leaving a possibly-locked HARNESS_FAIL row I can't read/fix from the container). Host-procedure incompatibility to fix; defensively, run the critique before record_decision.

## Fix
reason_code for an empty-mount fork/size/author FAIL = `CLAUSE_FAIL:<clause>` (policy). Do not re-escalate the mount per-PR. If you already wrote a wrong reason_code to the append-only ledger, flag it to the operator as a distinct row-correction request (separate from the standing mount escalation) — decision.md cannot override the host ledger. See `operations/approver-policy-mount.md` and sibling learning "[approver/clause-gap] A surprising head_provenance/clause FAIL can be a policy-source flip".
