---
title: "A reported bug on a deprecated Slang feature is often working-as-specified — check the spec proposal + a locking diagnostic test before recommending a fix"
type: learning
topic: slang-compiler
source: learnings/1789395604535-a-reported-bug-on-a-deprecated-slang-feature-is-of.md
---

# A reported bug on a deprecated Slang feature is often working-as-specified — check the spec proposal + a locking diagnostic test before recommending a fix

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789394701374-7cqth4
written_at: 2026-09-14T14:20:04.535Z
---

# A reported bug on a deprecated Slang feature is often working-as-specified — check the spec proposal + a locking diagnostic test before recommending a fix

When triaging a reported "bug" that involves a **deprecated** Slang feature (i.e. the compiler emits a deprecation warning like E30816 "support for X is unstable and will be removed"), do NOT assume it's a defect to fix. Before mapping fix approaches, run two cheap grounding checks:

1. **Read the formal spec proposal.** Feature semantics live in `external/spec/proposals/00N-*.md` (and mirrored in `docs/proposals/`). The behavior may be explicitly documented as intended. Example: shader-slang/slang#13064 — a derived struct whose base has a user `__init` gets NO synthesized constructor, so `Derived x = {}` / `Derived()` fail with E30513. `proposals/004-initialization.md:149-162` states exactly this ("if the base struct has explicit ctors, the compiler will not synthesize a constructor for the derived struct"). The suppression is a deliberate early-return in `_synthesizeCtorSignature` (`slang-check-decl.cpp:20073`) whose own comment cites that proposal.

2. **Grep `tests/` for an intentional locking `//DIAGNOSTIC_TEST` that asserts the exact error.** If a test asserts the reported error message on the reported input shape, the behavior is deliberately locked in — changing it means rewriting that test, which reframes any "fix" as a language-design decision, not a routine bug fix. In #13064, `tests/initializer-list/struct-inherit-diagnostics.slang:25` asserts the exact `= {}` empty case → `//CHECK: cannot use initializer list`, refuting the hypothesis that the empty case was an unspecced oversight.

Disposition when all three hold (deprecation warning + spec-documented + locking test): **document / won't-fix, NO-GO on a fixer PR**, defer any behavior change to a maintainer. Still reproduce + apply `reproduced` (the behavior IS real) and post a value-add root-cause 5-bullet as the system-of-record — but frame it as working-as-specified, not a defect. This is doubly reinforced when the reporter is a self-assigned MEMBER who filed it "for documentation purposes." Confirmed pattern; parent ratified NO-GO.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789395604535-a-reported-bug-on-a-deprecated-slang-feature-is-of.md`_
