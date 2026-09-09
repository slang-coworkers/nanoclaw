---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787737606610-g6a2kh
written_at: 2026-08-28T11:41:37.143Z
---

# [approver/infra-abstain] DECISION_REVIEW critique can gate on the UNTRUSTED author diff, forcing an ESCALATED abstain on a clean PR

**PR:** shader-slang/slang-rhi#843 @17d8c79f41fc ("handle PushConstant binding ranges in bindAsValue", +4/−1). Fallback tier. My derivation = WOULD_APPROVE and codex confirmed it sound across every round ("functional implementation and ordinary decision-state mapping remain undisputed"). Recorded outcome = **ABSTAIN_POLICY / ESCALATED** anyway.

**Symptom.** The DECISION_REVIEW codex critique held a must-fix through 3 rounds on `pr.diff:19` — a comment in the *PR author's* source ("No action needed for sub-objects bound though a `StructuredBuffer` or a push constant"), applying its "comment-hygiene (when a code diff is under review)" rule to the untrusted diff I was DECIDING ABOUT. That target is outside my read-only edit surface: I never write to GitHub and cannot edit the author's PR. The mechanical delivery gate then blocks WOULD_APPROVE until OUTPUT_REVIEW=approve, and codex offered only (a) escalate to operator or (b) ABSTAIN:CRITIQUE_MUSTFIX. Operator escalation (`ask_user_question` timeout:0) TIMED OUT ~27h → recorded ESCALATED.

**Root cause.** A critique-gate SCOPE bug: DECISION_REVIEW is defined to gate MY decision derivation (clauses-from-data, verdict-parse-matches-doc, tier-stated), NOT to code-review the untrusted PR. There is no CODE_REVIEW stage in the approver flow because the approver authors no code. Codex treating `gh pr diff` output as "a code diff under review" collapses "review the change" (not my job) into "review my decision" (the actual gate). A stylistic nit in the author's diff — which you can almost always find — thus becomes a forced abstain, pushing the abstain rate up on exactly the over-caution axis this approver's calibration record flags as its dominant error (#817 retraction, #819, #840).

**How to catch it.** When a DECISION_REVIEW must-fix names a `file:line` that is (a) in the untrusted PR diff / `gh pr diff` output, (b) not in any artifact you authored (decision.md / output.md / review-doc.md synthesis), and (c) something you cannot change as a read-only approver — it is a CODE finding about the change, advisory-to-maintainer, NOT a defect in your derivation. It cannot force CRITIQUE_MUSTFIX (that code is for a held finding on YOUR reasoning). Ask codex to point to the *false sentence in your deliverable*; if none exists, the finding is out-of-scope for the gate.

**Fix / what I did.** Contested scope (codex eventually agreed pr.diff:19 is "advisory-to-maintainer for this OUTPUT_REVIEW scope; no authored deliverable falsely represents the comment as acceptable"). But the DECISION_REVIEW verdict stayed must-fix, so I could not clear the gate for WOULD_APPROVE. Per soft-cap policy ("escalates to a human; never silently passes") and codex's own instruction, I escalated rather than override the mechanical gate OR record the disputed CRITIQUE_MUSTFIX. When the human escalation itself went unanswered, `ESCALATED` (not CRITIQUE_MUSTFIX) is the accurate code — it records the unanswered soft-cap escalation; both are code/derivation-neutral policy abstains. On the merits my recommendation remains WOULD_APPROVE; the join scores against that.

**Transferable rules.**
1. A DECISION_REVIEW/OUTPUT_REVIEW must-fix on a line in the UNTRUSTED input diff is advisory-to-maintainer, not a gate-blocker on your deliverable — demand the false sentence in YOUR artifact or treat it out-of-scope.
2. CRITIQUE_MUSTFIX ≠ "the author wrote a so-so comment"; it is a held finding on your derivation you decline to fix. Don't record it for an author-source nit.
3. When the gate is mechanical and the human tie-breaker times out, `ESCALATED` is the honest terminal code (unresolved soft-cap), distinct from CRITIQUE_MUSTFIX which omits that a human was asked.
4. Both ESCALATED and CRITIQUE_MUSTFIX are INFRA-family reason_codes that burn the infra-abstain gate → this is a procedure/harness gap to fix (scope the comment-hygiene rule to authored diffs), not a code signal.

**Functional note for future recall (slang-rhi push-constant handling):** in `BindingDataBuilder::bindAsValue`, `PushConstant` correctly belongs with the `ConstantBuffer`/`ParameterBlock` no-ops — push-constant DATA is written on a separate path (`vk-command.cpp:1612-1616` `vkCmdPushConstants`, populated in `bindAsEntryPoint`), so the descriptor loop legitimately does nothing. Matches the reflection defect-class (slang reflection reports push-constant ranges as descriptor ranges; the consumer must skip them). Widening-only case additions ⇒ no dead-flag/silent-skip risk; push constants are Vulkan-specific ⇒ no cross-backend gap. Sibling of #842.
