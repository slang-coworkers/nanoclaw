---
type: chain
title: "slang#14075 — explicit generic associated-type equality does not satisfy an interface `__constraint` requirement (E38029)"
description: Human-filed by kaizhangNV (MEMBER, self-assigned) 2026-10-30 00:19:34Z, found during portable-RT work. Triaged bug/medium/P2/frontend 10-30 00:35Z; NOT #13509's cause (equality-side sort in checkGenericTypeEqualityConstraintSubType + one-way isSubtype). Parked, owned by the reporter; R6 (not crash-exempt) to 11-03 00:19:34Z; triager one-shot t-1bc36e posts 11-03 00:30Z; no fixer without the reporter's go-ahead.
tags: [frontend, conformance, associated-type, equality-constraint, r6]
resource: /workspace/agent/reports/triage/triage-14075.md
---

# slang#14075 — `where ShaderType.Context == ConcreteContext` does not prove `IGroup`'s `__constraint Shader.Context == Context`

**Ask.** `struct Group<ShaderType> : IGroup where ShaderType : IStage where ShaderType.Context == ConcreteContext`
with `typealias Context = ConcreteContext; typealias Shader = ShaderType;` fails with E38029 (does not conform to
`IGroup`). Controls that pass: a non-generic group; `typealias Context = ShaderType.Context;`; a generic function using
the same `where`. Moving the equality into a refined `IConcreteStage` also fails. Fails on 2026.17.1 and the
reporter's frontend-only build 2026.18-55-gb6a5542f2. The reporter says this is an independent reproducer, not a
proven distinct root cause, and asks for it to be attached to an existing issue if a maintainer finds the same defect.

**Routing (10-30 ~00:2xZ).** Live check: open, 0 comments, no labels, no type, assignee kaizhangNV (self, 00:19:34Z).
The memory grep for 14075 had no hit; the only session on the thread was my webhook session. Related record:
[#13509](13509-generic-member-equality-nested-assoc.md) (same reporter; equality not propagated to a nested
associated type, root cause in `slang-check-inheritance.cpp`, Fix A prototyped, HOLD). The reporter distinguishes
#14075 from #13509, #12874, #11472, #12826 and #12822. Same-reporter siblings handled the same way:
[14066](14066-result-void-error-extraction.md), [14067](14067-ir-validate-throw-terminator.md),
[14070](14070-dxil-noinline-ignorehit-validation.md).
Dispatched to slang-triager on `gh-issue-shader-slang/slang-14075`, asking it to check specifically whether this
shares #13509's root cause.
- 10-30 00:22Z, triager ack: reproducing on ToT and comparing with the #13509 failure site and the Fix A prototype; local only under R6.

**Triage (slang-triager, 10-30 00:35Z, ToT 1f0b33b86; the triager's findings. I checked only that the function is at :4908 and that the
call at :4857 sits inside `shouldRunNonEssentialValidation()`.)** bug / medium / frontend semantic check / P2. Not a duplicate of #13509.
- `checkGenericTypeEqualityConstraintSubType` (`slang-check-decl.cpp:4908`, #8445/#8851) orders the sides of `Shader.Context == Context`
  by owner declaration order (IStage first ⇒ `This.Context == This.Shader.Context`). The conformance check (`findWitnessForInterfaceRequirement`
  :10751) then asks `isSubtype(ConcreteContext, ShaderType.Context)`, which scans only `ConcreteContext`'s facets, so the where-clause
  equality is never used ⇒ E38029 (:10807). The solver has the same one-way check (`slang-check-constraint.cpp:3007`).
- Order-dependent: passes if `IGroup` is declared before `IStage`, or with `-disable-non-essential-validations` (the sort runs only
  behind that gate, so the flag changes semantics).
- #13509's Fix A prototype does not fix it (built in `wt-14075`); a double dissociation separates the two issues.
- Release-boundary note: a sibling generic-call form passes on v2025.17.2 and fails from v2025.18 (first with #8445). The reporter's exact
  form does not parse on 2025.17.2, so no `regression` label.
- Rec A: one two-way equality check shared by the conformance check and the solver (open question: which witness to store for a reverse
  proof). B (store the deeper projection as sub, #11472's direction) is not enough alone.

**Parked 10-30 00:35Z,** owned by the reporter. Nothing on GitHub (live check: 0 comments, no labels, no type). The draft is in the
triager's memory (`issues/comment-14075.md`); worktree `wt-14075` (ToT + Fix A, uncommitted) is kept. One-shot **t-1bc36e** runs
2026-11-03 00:30Z: if no reporter PR or maintainer comment, it posts the 5-bullet, then adds `reproduced` + Type=Bug only if still blank.
