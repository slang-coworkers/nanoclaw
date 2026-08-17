---
title: "[approver/critique-mustfix] Don't call an ABI-contract finding 'refuted' just because in-tree callers are safe"
type: learning
topic: review-approval
source: learnings/1785426158100-approver-critique-mustfix-don-t-call-an-abi-contra.md
---

# [approver/critique-mustfix] Don't call an ABI-contract finding "refuted" just because in-tree callers are safe

## Symptom
On slangpy#1082 I initially marked CodeRabbit's 🟠 buffer-contract finding as
"CLEARED / unreachable on any supported path." The DECISION_REVIEW critique
(codex) flagged this **must-fix** as an overclaim.

## The finding
CodeRabbit: the Python fallback `python_get_signature` (torch_bridge.h) accepts any
buffer where `sig.size()+1` fits, while the native path requires
`buffer_size >= TENSOR_BRIDGE_SIGNATURE_BASE_SIZE(64) + rank`. Same tensor →
success in fallback, `BUFFER_TOO_SMALL` in native.

## Why my "refuted" was wrong
My math was: divergence needs a buffer in `[sig+1, 64+rank)`; torch caps rank at 64
(verified: pytorch `kVmapMaxTensorDims`/`kMaxNamedTensorDim=64`); both in-tree
callers now pass a 128-byte buffer = 64+MAX_RANK, so neither path diverges. That is
correct — **but it only proves the two current in-tree callers are safe.**
`TensorBridge_GetSignatureFn` is an **exposed ABI function pointer** (in the
`TensorBridgeAPI` struct) with a *documented* minimum-buffer contract. The native
side enforces it; the fallback does not. An external or future caller passing a
buffer in the divergence window would still observe the mismatch. So the public
contract mismatch is real; it's just not reachable via current in-tree callers.

## Transferable rule
"No current caller triggers it" ≠ "the finding is refuted", especially for anything
crossing a **published ABI / API boundary** (extern "C" fn ptrs, versioned structs,
plugin entry points). Narrow the conclusion to "no impact on current in-tree
callers" and **retain the contract-level gap** as a real (possibly non-decision-
moving) robustness finding. Reserve "refuted/unreachable" for cases where the
trigger is impossible for *any* caller, not just the ones you enumerated in the tree.

## How to catch it
Before writing "unreachable/refuted": ask "is this behind an exposed API/ABI
surface?" If yes, the set of callers is open — bound the claim to what you actually
enumerated (in-tree) and keep the contract gap on the record.
Related: [[review-approver-challenger-calibration]] (false-positive refutations).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785426158100-approver-critique-mustfix-don-t-call-an-abi-contra.md`_
