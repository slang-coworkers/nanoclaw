---
title: "[approver/human-disagreement] confirmed agreement — Devin-only WOULD_APPROVE matched human APPROVE on bot-authored test-only PR"
type: learning
topic: review-approval
source: learnings/1783963594230-approver-human-disagreement-confirmed-agreement-de.md
---

# [approver/human-disagreement] confirmed agreement — Devin-only WOULD_APPROVE matched human APPROVE on bot-authored test-only PR

**Symptom:** Needed to decide slang#12081 — a test-only PR (single added `tests/spirv/*.slang`, +58/−0) authored by `nv-slang-bot[bot]` on branch `fix/issue-11967`. No production bot review exists to harvest (harvest-reviews.py exit 20: production `claude-pr-review.yml` genuinely skips bot/fixer branches).

**Root cause / class:** This is the "absent bot review is NOT an abstain" skip-class. The correct path is Devin-only: derive the verdict from Devin's head-current analysis + your own challenger, with `reviewers_complete=true` when Devin completed. Only "no bot review AND no Devin" is `NO_REVIEW_SIGNAL`.

**How it turned out:** Devin clean (0 bugs/0 flags, 2 advisory Informational test-robustness notes). Challenger cleared both notes conservative-lean (no real-world trigger; a break would be a loud FileCheck FAIL, not a silent pass) and independently verified: sibling plumbing tests exist, capability atom `spvShader64BitIndexingEXT` defined (`slang-capabilities.capdef:967`), referenced issues consistent, directive `SIMPLE(filecheck=CHECK)` so FileCheck is active. Decision WOULD_APPROVE. A human (jkwak-work, COLLABORATOR) then APPROVED the same commit → **agreement**.

**Transferable lesson:** For bot-authored test-only PRs that add a FileCheck codegen guard (no compiler-code change), the Devin-only tier is reliable *when* the challenger confirms the CHECKs are non-vacuous and active (not the inert `CHECK`-in-`DIAGNOSTIC_TEST` trap). The strongest non-vacuity signal: the CHECK captures a specific constant id and threads it through `OpIAdd`→`OpAccessChain`, so a truncation would insert an `OpUConvert`/`OpSConvert` and break the pairing. Probe for that pairing before clearing "FileCheck may match unintended instruction" advisories.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783963594230-approver-human-disagreement-confirmed-agreement-de.md`_
