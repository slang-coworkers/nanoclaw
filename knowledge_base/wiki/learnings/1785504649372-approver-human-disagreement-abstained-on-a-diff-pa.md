---
title: "[approver/human-disagreement] Abstained on a diff-pair cache-key OPEN_GAP (primal-only keying); human merged — invariant held at runtime"
type: learning
topic: review-approval
source: learnings/1785504649372-approver-human-disagreement-abstained-on-a-diff-pa.md
---

# [approver/human-disagreement] Abstained on a diff-pair cache-key OPEN_GAP (primal-only keying); human merged — invariant held at runtime

## Symptom
slangpy#1082 R4 @c4ae890: head-current Devin came back 0 🔴 (buffer concern demoted
to informational), CI green 12/12 — I was heading to WOULD_APPROVE. codex
DECISION_REVIEW returned must-fix on a genuine OPEN_GAP, so I recorded
ABSTAIN_POLICY/OPEN_GAP. The human (ccummingsNV) then **merged** the commit
(APPROVED-equivalent). Mismatch: abstained-where-approved (milder than a false-safe;
I did not approve something the human rejected).

## The gap I flagged (real, but likely inconsequential)
The PR's new `NativeTorchTensorDiffPair` cache-signature path
(`slangpy.cpp:1109-1127`) encodes only the **primal** tensor's signature when both
primal+grad exist (`:1122` = `has_primal ? primal : grad`), and the marshall derives
dtype/dims/shape from the primal only (`torchtensormarshall.py:298-301`), with
`grad_marshall` reusing those values (317-326). By the #1052 superset lens, grad
dtype/shape is neither in the key nor validated to match primal → a matching-primal /
differing-grad pair could collide on one cache key. Untested by the 4 new tests.

## Why the human was right to merge (what I couldn't establish from staged code alone)
Post-merge I traced the runtime backward path: a diff-pair's grad is ALWAYS either
`create_zeros_like_tensor(primal)` (input grads — matches primal by construction,
`slangpy.cpp:584`) or the upstream `grad_output` (output grads — matches the output
primal by torch's autograd invariant, `:594`). So in the real dispatch path grad
dtype/shape tracks the primal; the divergent-grad case my gap worried about isn't
reachable through the autograd flow. The author had this invariant as implicit domain
knowledge; my read of the isolated cache-key code couldn't prove it, so
conservative-lean correctly produced an ABSTAIN.

## Transferable lesson
1. **The procedure worked as intended.** A must-fix on the derivation + an unproven
   invariant ⇒ ABSTAIN, never round up — even with 0 Devin bugs and green CI. This is
   the *good* failure direction (a human looks) not the dangerous one (false approve).
2. **When a cache-key change keys on ONE of a multi-tensor aggregate (primal of a
   primal/grad pair, first of a list, etc.), the superset question is: can the OTHER
   members diverge in a dispatch-relevant dimension?** Answer it from the CONSTRUCTION
   path, not just the key-builder: if the other members are always derived from / must
   match the keyed one (zeros_like, torch autograd shape invariant), the primal-only
   key IS a superset and the gap is a non-issue. Check the construction/runtime path
   before flagging — had I traced `autograd_backward` during the challenger (not just
   post-merge), I might have cleared it to advisory. Next time: for a cache-key gap,
   trace where the un-keyed field is set before calling it OPEN_GAP.
3. Devin run-to-run variance is real: same byte-identical torch_bridge_impl.cpp:126
   was 🔴 in R2/R3 and informational in R4. Don't over-index on a single run's
   severity label; reason from the code.
Related: [[review-approver-challenger-calibration]], [[slangpy-torch-autograd]]
(#1052 superset lens, #1056 mixed requires_grad).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785504649372-approver-human-disagreement-abstained-on-a-diff-pa.md`_
