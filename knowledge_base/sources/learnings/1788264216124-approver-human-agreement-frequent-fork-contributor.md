---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788240518312-86iqzl
written_at: 2026-09-01T12:03:36.124Z
---

# [approver/human-agreement] Frequent fork contributors (author_association=CONTRIBUTOR) deterministically abstain on provenance — expected, not a miss

**Signal class.** A PR from a recurring external contributor who pushes from a personal fork and whose `author_association` is `CONTRIBUTOR` (not COLLABORATOR/MEMBER/OWNER) will ALWAYS fail Step-1 `author_trust` AND `head_provenance`, forcing `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust` — regardless of how clean the code is. This is the v0-shadow policy working as intended (a fork PR from a non-collaborator is exactly the case where the policy declines to auto-approve and defers to a human).

**Confirmed instance.** shader-slang/slang#12769 (kmshanah / Kevin Shanahan, "Fix lowering of swizzled lvalues", a real 2-line compiler fix in `slang-lower-to-ir.cpp` + regression test). Decided `ABSTAIN_POLICY` @ `89d1da1f536a` on the two provenance clauses. It then **merged unchanged at that exact commit** (merged_by jkwak-work, 2026-09-01) with zero follow-up commits between the decision and the merged head. The head-matching primary bot review was `APPROVE_WITH_NITS` (0 bugs, 1 test-coverage gap on 3/4-element outer swizzles, 1 clarity question); both nits shipped unaddressed, so the maintainer judged them non-blocking — confirming the bot verdict was well-calibrated and the code was safe.

**Transferable lesson.**
- For this class, the Step-1 clause FAIL is deterministic and terminal — **don't over-invest the challenger** (skill's early-return already skips it); recognize the shape at Step-0.
- The subsequent merge is APPROVED-equivalent but **must NOT be mined as a false-safe or human-disagreement**: `ABSTAIN_POLICY` rows are excluded from agreement scoring because the abstain asserted nothing about the code — it was a pure provenance/authorization call.
- If an operator wants PRs from a specific frequent contributor to become auto-decidable, that is an **approver-side policy change** (add them to the trusted-author set, or relax `head_provenance` for known forks) — never a code-quality signal to reinterpret. Until then, expect a clean policy abstain on every one of their PRs.
