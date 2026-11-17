---
title: "[approver/human-disagreement] slang#12922 join: by-design author_trust false-abstain, merged at R2 decision commit; Metal blast-radius probe validated"
type: learning
topic: review-approval
source: learnings/1794811546953-approver-human-disagreement-slang-12922-join-by-de.md
---

# [approver/human-disagreement] slang#12922 join: by-design author_trust false-abstain, merged at R2 decision commit; Metal blast-radius probe validated

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788766677155-bns1j4
written_at: 2026-11-16T06:45:46.953Z
---

# [approver/human-disagreement] slang#12922 join: by-design author_trust false-abstain, merged at R2 decision commit; Metal blast-radius probe validated

**PR:** shader-slang/slang#12922 (CONTRIBUTOR bot `fix/issue-12920`, 6 new `getTypeNameHint` cases in `slang-ir-util.cpp` + 3 SPIR-V debug tests)

**Symptom:** R2 decision (@0a6dee79f3f2) was ABSTAIN (`CLAUSE_FAIL:author_trust`, empty-mount v0-shadow era) while MEMBER pdeayton-nv APPROVED the same head; JOIN: merged by jkwak-work at exactly the decision commit, 0 follow-up commits. By-design false-abstain class (same as #12895/#12903/#12801/#12879/#12899), excluded from agreement scoring — not a miss.

**Root cause (of the abstain, not the merge):** bundled v0-shadow policy lacks CONTRIBUTOR in `trusted_associations` for bot fixers. Resolved at the policy level 2026-09-09 by the wide-r2 mount (nanoclaw#1500) — under the current policy this PR's author_trust clause PASSES, so this abstain class no longer fires.

**What the join validated (the real signal):** R1 flagged a Devin 🔴 (typed-texture-handle name collision in `getTypeNameHint` Metal output, wrapper `wrapper_DescriptorHandle<…>` @ slang-ir-util.cpp:851 region). The author reconciled the Metal test in-PR (commit dc4724e) before merge, and the human approved. The cross-backend blast-radius probe for type-name changes (check Metal/CUDA emitters, not just SPIR-V/DXIL, for the touched name path) caught a real issue humans cared about — keep probing it. Also: R1's CI red (SlangPy Tests) was a flake; by R2 CI was green — don't let a single red external status at one revision harden into a merits judgment; re-check on the next revision before calling a PR risky on CI grounds.

**How to catch / Fix:** already fixed by the wide-r2 mount; nothing to change in the procedure. Calibration note only: Devin-🔴 findings that are later fixed in-PR + approved by a human corroborate the challenger's value; the deterministic clause short-circuit (author_trust) prevented a would-have-been-correct WOULD_APPROVE here, which is exactly why the mount was widened.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1794811546953-approver-human-disagreement-slang-12922-join-by-de.md`_
