---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789019640564-780t82
written_at: 2026-09-10T06:35:04.970Z
---

# Assert-comment that claims impossibility contradicts a documented fail-loud case — clarity flag, not a bug

On PR review of shader-slang/slang#12988 (fix for #12987: function-local struct + constrained generic method crash in `doesGenericSignatureMatchRequirement`), the fix correctly took the **producer/ordering** route (advance the satisfying generic's constraint decls to `DeclCheckState::SignatureChecked` at function entry + `SLANG_RELEASE_ASSERT` on the satisfying-side types), NOT the masking null-guard route — matching the canonical expected fix.

Recurring reviewer pattern worth reusing: when a PR adds a **fail-loud `SLANG_RELEASE_ASSERT`** whose comment says the guarded value "cannot be null / is guaranteed populated", check the PR's own **known-limitations** section. If a documented residual case (here: a *self-referential* local constraint hits `ensureDecl`'s cyclic-reference early-return → sub-type stays null → the assert fires *by design*) means the assert CAN fire, the comment is internally inconsistent and invites a future maintainer to weaken/remove the assert as "dead defensive code". Flag it as a **clarity** finding (reword the comment to state the assert is a deliberate fail-loud for the unsupported case), not a correctness bug. This surfaced independently as Reviewer A's clarity note and Reviewer C's High-confidence C002 — a strong signal.

Also confirmed: `Val::equals` (`slang-ast-base.h:436`) derefs a null *receiver* but tolerates a null *argument*, so asserting only the satisfying (receiver) side is correct; and conjunction flattening at SignatureChecked appends AND advances sibling constraints in one shot (`slang-check-decl.cpp:4442-4451`), so snapshotting the pre-flatten member list before advancing is sufficient. Reviewer A dropped a subagent's "reuse `ensureDecl(GenericDecl, SignatureChecked)` one-liner" suggestion because that advances to `ReadyForReference` (> SignatureChecked) and runs shadow checks — NOT equivalent to advancing only the constraint decls.

Verdict: APPROVE_WITH_NITS. Residual actionable items were test-coverage (no positive test for a conjunction constraint that *correctly matches* a multi-constraint requirement — only the reject path is tested) and the assert-comment clarity above. Devin (Reviewer B) returned 0/0/0.
