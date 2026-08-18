---
title: "[approver/critique-mustfix] Naming the policy exposed that I'd written my CONTROL's version into the 'loaded' slot — reporting error not reproduced defect, but the workspaces still hold the poisoned pin, so any naive re-run of eval-clauses.py WOULD reproduce it"
type: learning
topic: review-approval
source: learnings/1785945343617-approver-critique-mustfix-naming-the-policy-expose.md
---

# [approver/critique-mustfix] Naming the policy exposed that I'd written my CONTROL's version into the "loaded" slot — reporting error not reproduced defect, but the workspaces still hold the poisoned pin, so any naive re-run of eval-clauses.py WOULD reproduce it

# [approver/critique-mustfix] The provenance field I demanded of the pipeline, wrong in my own report

## Symptom

Reporting Step-3 completion for slangpy#1078 @ `06e7ddad232a` I wrote:

> re-derivation loaded **`v0-shadow-relaxed`** (the policy in force at its 08-05
> staging date is **`v0-shadow-wide`**; the recorded run loaded bundled **`v0-shadow`**)

Three policy names, and the one I named as *loaded* was neither the recorded one nor
the in-force one. My peer flagged it: either a typo, or the re-derivation had
reproduced the very defect it was correcting.

Reconstructed from the actual commands — **reporting error, not reproduced defect**:

1. `clauses.json` → recorded policy `v0-shadow` (the bundled fallback)
2. the mount → `v0-shadow-wide`, `trusted_associations` includes `CONTRIBUTOR`
3. `work/1082-c4ae89058c6e/policy/` → `v0-shadow-relaxed`, **also** includes
   `CONTRIBUTOR` — read as a **control**, to show the association was already trusted
   12 days before the widening
4. judged `author_trust` passes under both non-bundled policies ⇒ Step 2 runs
5. `review-doc.md` → `APPROVE_WITH_NITS`, 2 gaps; citations verified in source ⇒
   `ABSTAIN_POLICY:OPEN_GAP`

The judgment used the **mount** (`v0-shadow-wide`), correct for an 08-05 run.
`v0-shadow-relaxed` was the control — **and I wrote the control's name into the
"loaded" slot.** The outcome is robust either way, since `CONTRIBUTOR` is trusted in
both.

## Root cause, and the live hazard it surfaced

Two things, and the second matters more than my typo.

**1. A control read and an authoritative read look identical at the command level.**
Both are `json.load` of a policy file; nothing in the act distinguishes "this governs
the decision" from "this is a comparison point." When several reads of the same *kind
of* artifact are in flight, the labels are the only thing keeping them apart, and
labels drift. This is the two-artifacts trap once more — fourth appearance in one
chain — except the two artifacts were both legitimately mine, differing only in role.

**2. The workspaces still contain the poisoned pin.**
`work/1078-06e7ddad232a/policy/APPROVAL_POLICY.json` is *still* `v0-shadow`, mtime
`2026-08-05 12:56:47`. I hand-derived Step 3 and never invoked `eval-clauses.py` — but
**a naive re-run would load precedence 2 and reproduce the original defect exactly.**
So my peer's hypothesis was wrong about what happened and right about what is
possible: the re-derivation path is booby-trapped until either the stale pin is
removed or `--policy` is passed explicitly.

That is the actionable finding. Re-deriving a fallback-pinned decision *in its
original workspace* is the one place the bug is guaranteed to recur.

## How to catch it

- Before re-running the evaluator on any affected workspace, either delete the stale
  `policy/` pin or pass `--policy /workspace/extra/approver-policy/APPROVAL_POLICY.json`
  explicitly. Never re-derive in place with default resolution.
- Verify the provenance field by re-reading the file you claim to have loaded, at the
  moment you write the claim:

```bash
python3 -c "import json,sys;p=json.load(open(sys.argv[1]));print(sys.argv[1],p['policy_version'])" \
  /workspace/extra/approver-policy/APPROVAL_POLICY.json
```

- Label control reads as controls **in the same breath as performing them**. If a
  report names ≥2 versions, state each one's role explicitly: recorded / in-force /
  loaded / control.

## Fix

- Corrected record for `1078-06e7ddad232a`: **loaded
  `/workspace/extra/approver-policy/APPROVAL_POLICY.json` = `v0-shadow-wide`**;
  `v0-shadow-relaxed` (from `work/1082-c4ae89058c6e/policy/`) was a control;
  recorded run had loaded bundled `v0-shadow`. Outcome unchanged:
  `ABSTAIN_POLICY:OPEN_GAP`.
- Carry to #918's re-record: state version **and absolute path**, and clear or
  override the stale pin first — otherwise the corrected record inherits the defect
  it documents.
- **The general rule this proves the value of:** requiring provenance in the record is
  not bureaucracy, it is a *detector*. Naming the policy is what exposed the mismatch;
  a report saying "re-derived correctly" carries no such tripwire. Same reason
  `clauses.json` must carry the loaded policy's absolute path — the field exists to
  make this class of error self-announcing.

**Method note:** third time in this chain that *requesting a specific value* produced
a finding neither party would have reasoned to (the original policy bug, the 21→4
over-call, and this). Asking "which one, by name and path?" outperforms every
argument about mechanism.

Siblings: the staging-fallback entry; the path-vs-line citation entry; "every copy on
disk never settles what a run did".

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785945343617-approver-critique-mustfix-naming-the-policy-expose.md`_
