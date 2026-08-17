---
title: "[approver/challenger] Signature/serialization-format changes across a versioned bridge must bump the version constant"
type: learning
topic: review-approval
source: learnings/1783881950122-approver-challenger-signature-serialization-format.md
---

# [approver/challenger] Signature/serialization-format changes across a versioned bridge must bump the version constant

## Symptom
A slangpy PR (#1054, fixing #1052) correctly added a `requires_grad` grad bit to the torch cache signature (`[Dn,Sm]`→`[Dn,Sm,Gk]`) in BOTH the native C++ and Python-fallback bridge paths, wired to the real root cause, with good two-path + two-format test coverage. On the supported (matched-version) path it works. But it left `TENSOR_BRIDGE_API_VERSION` (src/slangpy_torch/tensor_bridge_api.h:193) at 7.

## Root cause (the reachable defect)
The native-vs-fallback compat gate (src/slangpy_ext/utils/torch_bridge.h:110) accepts a native `slangpy_torch` binary iff `m_api->api_version == TENSOR_BRIDGE_API_VERSION && info_struct_size == sizeof(...)`. Both are UNCHANGED by a behavioral output-format change. So a user who upgrades the `slangpy` wheel (new Python fallback emits `Gk`) but keeps a STALE separately-pip-installed `slangpy_torch` native package (still v7, still emitting `[Dn,Sm]`) has the native path silently ACCEPTED → the grad bit is missing → #1052 is reintroduced with no warning. `slangpy` and `slangpy_torch` are independently-versioned pip packages, so version skew is a real deployment scenario, not hypothetical.

## How to catch it
When a PR changes the *output format* of any function whose result crosses a versioned ABI/plugin boundary (a serialized signature, a wire format, a cache key that another artifact also produces), check whether the boundary's version/compat constant is bumped. If the compat check only inspects struct layout / numeric version and NOT the behavioral contract, a format change without a version bump = a stale-peer-artifact defect. Confirm the convention by history: `git log`/`gh api commits` on the header — here the PRIOR bridge behavioral change (#816, commit c0d14cd2) bumped the constant 6→7, so bump-on-behavioral-change is the codebase's own established convention. A convention violation confirmed by history is a real 🔴, not a taste question.

## Fix (decision procedure)
This is a VERIFIED 🔴 → BLOCK (per "any 🔴 Bug => BLOCK"). Do NOT downgrade a source-verified reachable defect to ABSTAIN just because its *severity* feels debatable — "existence uncertain" and "severity debatable" are different axes; the fallback-tier "any doubt => ABSTAIN, never round up" caution guards against rounding UP toward approve, it does not license softening a verified 🔴 into an abstain. The actionable fix to hand the maintainer: bump the version constant AND treat the function's output format as part of the versioned contract the compat gate enforces.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783881950122-approver-challenger-signature-serialization-format.md`_
