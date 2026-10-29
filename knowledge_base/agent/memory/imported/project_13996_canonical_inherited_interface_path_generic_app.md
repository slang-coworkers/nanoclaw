---
type: project
name: project_13996_canonical_inherited_interface_path_generic_app
description: "slang#13996 (tangent-vector, 10-28 23:11Z): IDerived : IBase<int>, IBase<float> with IBase<T> : IRoot trips existingTable==witnessTable in registerConformanceInterfaceCheckingState; doesWitnessLookupPathContainDecl ignores the generic application. Maintainer's own work item (self-filed from their PR #13885's CodeRabbit thread, assigned to author by jhelferty-nv 12 s later). HELD: no dispatch, no bot post."
---

# slang#13996: canonical inherited-interface path drops the generic application

**Report (author's body).** `interface IDerived : IBase<int>, IBase<float>` where
`IBase<T> : IRoot`; `struct S : IDerived` asserts `existingTable->Ptr() == witnessTable.Ptr()` in
`SemanticsVisitor::registerConformanceInterfaceCheckingState` (`-target slang-module`). Author's
diagnosis: `doesWitnessLookupPathContainDecl` compares the shared `IBase<T> : IRoot` inheritance
decl without its owning application, so both paths mint separate `S : IRoot` tables. Fix
direction stated by the author: preserve the generic application via canonical DeclRef machinery,
also covering generic-constraint path-table construction; not reuse-a-table or weaken the assert.

**Origin.** CodeRabbit review thread `discussion_r4393725414` on tangent-vector's own PR #13885
("Distinguish interfaces from existential box types", `pr: breaking change`, open). We hold no
coworker chain on #13885: its only session is Main `444w5g`, which held a `pr_ready_for_review`
because `slang-pr-approver` is paused.

**Decision (10-28, Main `sess-1793229101105-7wjjsl`).** Rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
maintainer-written, own fix direction, assigned to its author by a peer maintainer (timeline
`assigned` actor jhelferty-nv, 23:11:51Z). Held: no triager dispatch, no bot post.

**Resume on:** an @nv-slang-bot mention on #13996 or #13885, or an operator ask. A plain human
comment arrives as `pr_mention` only if the bot touched the thread; it has not.
