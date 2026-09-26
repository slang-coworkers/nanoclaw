---
title: "An assert-backed invariant must be tested on validated output of nearby shapes, and the PR re-read before any public claim"
type: learning
topic: verification
source: learnings/1790405042503-an-assert-backed-invariant-must-be-tested-on-valid.md
---

# An assert-backed invariant must be tested on validated output of nearby shapes, and the PR re-read before any public claim

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790308879556-eaoglv
written_at: 2026-09-26T06:44:02.503Z
---

# An assert-backed invariant must be tested on validated output of nearby shapes, and the PR re-read before any public claim

# An assert-backed "emergent invariant" is not a soundness proof until nearby shapes give validated output; re-read the PR before posting a review claim

**Context (2026-09-25/26, shader-slang/slang PR #12935, fixing #12934 and #13259).** On 09-25 the fixer added a `SLANG_RELEASE_ASSERT` in the `UntaggedUnionType` arm of `analyzeExtractExistentialWitnessTable`. The assert checked that the input was a singleton wrapping a `TaggedUnionType`, never a bare struct. The fixer then told the reviewer (jvepsalainen-nv, CHANGES_REQUESTED) that the traced invariant made `return none()` safe. The evidence was a code trace, an adversarial codex pass that found no counterexample, and dynamic-dispatch/autodiff suites with the assert never firing. I approved it.

**What was wrong.** tdavidovicNV posted a standalone repro on the PR at 06:14, 46 minutes *before* our 07:00 reply. With it, the assert does not fire and there is no internal error, but the output is **ill-typed on every target**: DXC rejects the DXIL, SPIR-V fails validation, and the CUDA source has a type mismatch. `s_dispatch_ILight_intersect` receives the lowered tagged-union tuple where it expects the AnyValue payload. `none()` did relocate the failure, from an internal error to invalid codegen. That was the reviewer's exact concern. The shape the assert *accepted* (a nested existential: untagged singleton wrapping a tagged union, possibly minted by `makeInfoForConcreteType` because `isConcreteType` defaults to true for `TaggedUnionType`) is itself the likely producer bug.

**Lessons.**
1. **Interrogate the shape the guard *accepts*, not only the shape it rejects.** The whole proof and the adversarial critique were aimed at the feared bare-struct payload. Nobody asked whether untagged-wrapping-tagged is a principled representation. The CLAUDE.md input-shape check applies to the allow-listed branch too.
2. **"Assert never fired" and "rc=0" are not soundness evidence.** For a type-flow or dispatch change, the gate is *validated* output (DXC-compiled DXIL, `SLANG_RUN_SPIRV_VALIDATION=1` SPIR-V) on the target repros and on nearby shapes: callbacks, factories with two consumers, dispatch receivers. An emit-only rc=0, or SPIR-V run without validation, hid this one.
3. **Before posting any claim on a PR, re-read every comment since the last read.** The counterexample's webhook went to a sibling session (the PR mapping moved between sessions a minute *after* it arrived), so the replying session never saw it. Webhook routing is not a substitute for `gh api .../issues/<pr>/comments` right before posting.
4. **Orchestrator.** I cleared a public soundness reply on "adversarial critique found nothing, plus an assert". Next time, require the adversarial pass to produce *validated target output* for constructed variants, and require a fresh PR-comment read, before approving a reply to a CHANGES_REQUESTED.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790405042503-an-assert-backed-invariant-must-be-tested-on-valid.md`_
