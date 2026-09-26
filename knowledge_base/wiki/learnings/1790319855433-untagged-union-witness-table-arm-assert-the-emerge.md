---
title: "Untagged-union witness-table arm: assert the emergent invariant, and don't add a 'safe-side' regression test"
type: learning
topic: slang-compiler
source: learnings/1790319855433-untagged-union-witness-table-arm-assert-the-emerge.md
---

# Untagged-union witness-table arm: assert the emergent invariant, and don't add a "safe-side" regression test

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790309676336-9uc3si
written_at: 2026-09-25T07:04:15.433Z
---

# Untagged-union witness-table arm: assert the emergent invariant, and don't add a "safe-side" regression test

Working the #13259 ICE ("Unhandled info type in analyzeExtractExistentialWitnessTable"), which a triager reported as "already fixed by open PR #12935, just add a regression test":

- **Check the PR's real review state first.** #12935 was described as idle/mergeable but was actually in **CHANGES_REQUESTED**: the reviewer feared the `none()` arm *relocates* the crash for a concrete-struct payload. The triager/parent premise was wrong — always re-fetch review state before "just add a test."
- **A repro that compiles is NOT the reviewer's bar.** IR-dump + instrumentation showed #13259's untagged-arm hit was on a **dead** path (DCE'd) with an inner-**TaggedUnion** payload — i.e. the *same safe side* as the existing test, not the feared concrete-struct-on-a-live-operand shape. Adding it as "the test that resolves the concern" would have been an overclaim. Distinguish *removed before lowering* from *survived-but-lowered*, and *live* from *dead-code* extractions.
- **The invariant that makes `none()` safe:** an `ExtractExistentialWitnessTable` operand is always a frontend existential → refined info is a `TaggedUnionType` (`analyzeMakeExistential` never yields untagged; `flatUnionPropagationInfo` rejects tagged/untagged mixing). The only `UntaggedUnionType` reaching the arm is a singleton wrapping that tagged union (`makeInfoForConcreteType` at a merge); `getLoweredType` unwraps singleton→element0, so the tagged branch resolves it before `lowerExistentials`. A bare-struct payload only arises for never-boxed concrete values, which aren't EWT operands.
- **When an invariant is emergent, not proven, ASSERT it.** Added `SLANG_RELEASE_ASSERT(isSingleton() && as<IRTaggedUnionType>(getElement(0)))` — converts a would-be masked downstream `SLANG_UNEXPECTED` into a localized contract check. Use `SLANG_RELEASE_ASSERT` (not debug-only) for out-of-contract input so it holds in release too. This is exactly what satisfied the reviewer ("checked contract, not a silent none()"). Gate it by running the full `dynamic-dispatch`+`autodiff` suites — an assert-fire = a real counterexample.
- **Ops caveats:** base slang clone is shallow (`--depth 50`) → `git merge-base origin/master HEAD` is empty, so a clean rebase needs `--unshallow`; don't force-push a rebased branch over active review threads (defer rebase, land a fast-forward commit). `extras/formatting.sh` is a no-op with no args and needs a `clang-format→clang-format-17` shim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790319855433-untagged-union-witness-table-arm-assert-the-emerge.md`_
