---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787859746895-6bckri
written_at: 2026-08-27T20:02:48.707Z
---

# [approver/challenger-miss] Devin phantom-🔴 on comment/test-only PRs whose body narrates a fix that landed elsewhere

**Symptom.** slang#12116 (@5c0e69c0c059) is a comment- and test-only PR: it adds one SPIR-V FileCheck regression test + explanatory comments for #12110, after the *functional* fix landed in the already-merged #12263. On the Devin-only fallback tier (harvest exit 20 — production claude-code-action review skips bot-authored PRs), Devin flagged one 🔴 "Pull request write-up describes compiler changes that are not actually present" (slang-ir-float-non-uniform-resource-index.cpp:65). Per the skill's Step 2, any 🔴 ⇒ BLOCK — but the 🔴 was a false positive.

**Root cause.** Devin's own AI analysis in the *same* review concluded "no compiler behavior change; the diff against master is comment- and test-only." The 🔴 contradicted that. The PR body has a long Motivation/mechanism narrative (IR round-trip, peephole folds) that *reads* like a fix description; Devin mis-classified that narrative-vs-diff mismatch as a code Bug, when the body explicitly states up front ("Note on scope") that the functional fix is #12263 and "what remains is a regression test plus explanatory comments." The diff genuinely is comment/test-only.

**How to catch it.** When the sole/fallback review signal raises a 🔴 whose *premise* is about the PR write-up (not a concrete code/test defect), verify the premise mechanically before treating it as a Step-2 BLOCK: (1) extract the `.cpp`/code hunks from `gh pr diff` and confirm every `+` line is a `//` comment (context `case`/`if` lines are unchanged); (2) confirm CI at head is green per-lane (48/48 here — the FileCheck test passes on the real harness); (3) confirm any "the fix is elsewhere" claim — here #12263 MERGED. A 🔴 that is self-contradictory with the reviewer's own summary, and factually false against the diff, is NOT a "verified 🔴 Bug" and must not be recorded as BLOCK (that would put a false code-defect claim in the ledger). Equally it cannot be rounded up to WOULD_APPROVE — the guardrail forbids upgrading past a 🔴, and this is the fuzzier fallback tier.

**Fix.** The truthful state is ABSTAIN_POLICY / CHALLENGER_CONCERN (policy abstain, NOT infra: Devin ran clean, harvest correctly detected a production-skip, all clauses passed — so it does not burn the infra-abstain gate). Cite the mechanical verification in the challenger field so the human sees both that the 🔴 is spurious and the real residual concern (here a possibly-vacuous CHECK-NOT test-strength 🟡 at desc-heap-nonuniform-spirv.slang:102-105). Class signal for Step-0 recall: **comment/test-only PRs whose body narrates a fix that landed in a separate merged PR are prone to a fallback-reviewer phantom-🔴; adjudicate the 🔴's premise against the actual diff, don't parse-and-BLOCK.**
