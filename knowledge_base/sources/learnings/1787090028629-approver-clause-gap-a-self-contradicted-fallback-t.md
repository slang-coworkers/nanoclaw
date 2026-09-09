---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787088153007-vbjk9h
written_at: 2026-08-18T21:53:48.629Z
---

# [approver/clause-gap] A self-contradicted fallback-tier 🔴 forces ABSTAIN — no approver refutation state exists

**Symptom.** slang#12454 (a clean, CI-green, human-MEMBER-approved diagnostic PR) resolved to ABSTAIN_POLICY/CRITIQUE_MUSTFIX rather than WOULD_APPROVE, purely because the sole review signal (Devin, fallback/Devin-only tier — production review skips bot-authored `fix/issue-N` branches) emitted one 🔴 that was **demonstrably false**.

Devin's 🔴: *"new compiler warning ships without the required documentation update"* (`slang-lower-to-ir.cpp:9587`). It is self-contradicted by the artifact under review: (1) the diff DOES update two design docs (`control-flow.md`, `04-ast-to-ir.md`) — both listed in Devin's OWN change-summary section; (2) the change reuses the pre-existing `E41000` `unreachable-code` warning (`slang-diagnostics.lua` untouched), so no "new diagnostic" doc even applies.

**Root cause (the gap).** The decision procedure is deliberately one-directional about reviewer 🔴s: fallback tier maps any Devin bug → REQUEST_CHANGES; Step 2 maps any 🔴 → BLOCK; Step 3 says investigation "can only add caution, never upgrade a doc's 🔴 toward approval." That guard exists to stop the approver rationalizing past a REAL bug (the false-safe failure mode). But it has **no authorized state for an approver-audited false-positive refutation** — so a self-contradicted 🔴 forces either (a) a BLOCK the approver knows is factually wrong (untruthful), or (b) an unauthorized upgrade. The only honest exit is ABSTAIN_POLICY (a human must look). DECISION_REVIEW critique (round 1) correctly returned must-fix when I first tried to set bugs=0 / reach approval — confirming the override is not authorized.

**How to catch it.** When on the fallback/Devin-only tier and the single 🔴 is contradicted by the diff itself (docs the 🔴 says are missing are present; a "new diagnostic" that is actually a reused code), do NOT set bugs=0 to reach WOULD_APPROVE (the DECISION_REVIEW gate will must-fix it), and do NOT record a BLOCK you've shown to be false. Record ABSTAIN_POLICY with reason_code CRITIQUE_MUSTFIX, preserve the refutation in investigation.md for the human, and note the missing-state gap.

**Fix (procedure change to propose).** Add an auditable "approver-verified false positive" state: the approver may downgrade a fallback-tier 🔴 to advisory ONLY when the refutation is (i) established from the diff/source at the pinned head, (ii) recorded with file:line evidence, and (iii) gated through DECISION_REVIEW. Until that exists, a merge-ready PR with a bogus fallback 🔴 will keep abstaining. Note: no false-safe risk in this instance — a human MEMBER (jhelferty-nv) had already APPROVED the exact head, so the abstain over-conserved rather than under-conserved.
