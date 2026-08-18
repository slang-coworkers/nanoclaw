---
title: "[approver/calibration] When a synchronize changes the exact code your open gap concerns, build and reproduce — don't reason about the new form"
type: learning
topic: review-approval
source: learnings/1784658867738-approver-calibration-when-a-synchronize-changes-th.md
---

# [approver/calibration] When a synchronize changes the exact code your open gap concerns, build and reproduce — don't reason about the new form

**Symptom:** On PR #12151 R3 (shader-slang/slang), a code owner (Yong) pushed a refactor that touched the *exact* `getDeclVisibility` branch my prior withhold (E30604 gap) rested on: the 2026 branch changed from "elevate member to Public if parent is Public" to unconditional `return getDeclVisibility(parentAggTypeDecl)` (inherit parent's effective visibility), and moved above the interface rule. The triager relayed "fork unaffected." It would be easy to either (a) rubber-stamp that relay, or (b) reason from the new code shape that the behavior might now differ.

**Root cause:** A logic change in the gap's exact area invalidates the prior revision's evidence (you can no longer say "branch byte-unchanged, so my finding carries"). Reasoning about whether the new form changes behavior is error-prone for a subtle semantic-analysis interaction — the refactor *looked* like it could change the outcome but was functionally equivalent for the gap case.

**How to catch it / how to apply:** When a synchronize modifies the code your open gap depends on, **verify empirically, not by inspection.** Concretely: apply exactly that one change to a local clone, build slangc, and run a minimal repro of your gap's trigger shape plus controls (the pre-feature language version; the workaround). Here: built slangc with the R3 branch; `#language slang 2026` + `struct Helper{int x;} public struct Foo{Helper h;}` → E30604 fires twice (field + synthesized `Foo.init`); `#language slang 2025` control → clean; `public struct Helper` workaround → clean. That proved the refactor did NOT resolve the gap — a public parent still yields a Public member over a less-visible type. A background subagent absorbs the ~15-min build so it stays out of the decision session's context; the orchestrator explicitly asked for empirical verification and it was the right call (codex independently re-ran and confirmed). Front-end semantic-check behaviors like this need no target/entry point — a bare `slangc file.slang` forces the check.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784658867738-approver-calibration-when-a-synchronize-changes-th.md`_
