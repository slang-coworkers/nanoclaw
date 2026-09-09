---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788482380451-ptci9f
written_at: 2026-09-04T00:46:00.309Z
---

# [approver/human-disagreement] bot-fixer author_trust abstain aligned with a real MEMBER rework request (slang#12848)

**Symptom.** shader-slang/slang#12848 (bot-authored fixer PR `fix/issue-12847`, nv-slang-bot[bot] = CONTRIBUTOR) resolved to ABSTAIN_POLICY:CLAUSE_FAIL:author_trust under the empty policy mount (v0-shadow) — the same deterministic-abstain class logged repeatedly in memory. 5/6 clauses passed (head_provenance, commit_match, ci_green, no_protected_paths, tier_eligible 392L/4F); only author_trust failed.

**What's new / worth transferring.** Most prior members of this class were *by-design false-abstains* against genuinely-good PRs (a human MEMBER had already approved the exact head; PR merged unchanged — e.g. #12903, #12801). #12848 is the opposite calibration case: the abstain OUTCOME (\"a human must look\") aligned with a real not-approve signal on the head. mode=live_late because a human MEMBER (jkwak-work) had reviewed at the pinned head 26e9da458bf1 (state COMMENTED, so not a formal CHANGES_REQUESTED) with a substantive architectural objection: the +239-line pass B — a legalization pass that opens and iterates `spirv_asm` to CSE duplicate `OpGroupNonUniformBallot` — is the wrong layer; it should be `__intrinsic_op` + backend emit + IR-level dedup. The PR AUTHOR agreed, explicitly calling pass B \"the band-aid to remove.\"

**How to catch it / lesson.** (1) A COMMENTED-state human review can carry a REQUEST_CHANGES-shaped, author-acknowledged rework request — don't read state=COMMENTED as \"no objection.\" Read the inline review_comments, not just the review state. (2) When the review doc is Devin-only fallback and Devin merely echoes the PR body with \"no bugs,\" treat it as a description, not an audit — the live human thread is the stronger signal. (3) The author_trust abstain fired FIRST (Step-1 clause) and short-circuited before the verdict/challenger could weigh the human objection; the abstain reason_code (author_trust) therefore does NOT capture WHY a human should look here. That's fine for shadow mode, but if/when the mount is provisioned and author_trust passes for trusted bots, the challenger must be the one to catch the open, author-accepted rework request → CHALLENGER_CONCERN, never round up to WOULD_APPROVE.

**Fix / follow-up.** Await the merge/close join for #12848 to confirm direction (expect: not merged as-is; a re-layered follow-up). Empty mount remains the standing operator escalation — not re-escalated per-PR.
