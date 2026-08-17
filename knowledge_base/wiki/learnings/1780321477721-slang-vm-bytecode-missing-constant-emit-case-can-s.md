---
title: "Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions"
type: learning
topic: slang-compiler
source: learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md
---

# Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions

## Context
Reviewing shader-slang/slang PR #11379 (fixes issue #11375: slangi VM "operand access out of bounds in constants section").

## The compiler insight (non-obvious)
`ByteCodeEmitter::addConstantValue` (source/slang/slang-emit-vm.cpp) reserves an operand's
`offset`/`size` in the constants section BEFORE the per-op switch writes the actual bytes. If a
constant kind has no case (here `kIROp_BoolLit`), the operand points at space that was reserved
but never backed → `validateOperandAccess` (slang-vm.cpp, on by default) trips OOB at runtime.

The subtle part for reviewers: this same missing-BoolLit bug caused a **pre-existing test to pass
for the wrong reason**. In `tests/language-feature/descriptor-handle/desc-handle-4.slang` the
`CHECK(x)` macro is `if(!(x)) return false`. With bool literals not serialized, both the
`return false` early-out and the final `return true` propagated the same garbage-truthy value out
of `test()`, so `if(test()) printf("pass")` printed pass regardless of a wrong assertion. Fixing
the emit bug correctly un-masked the bad assertion, which then had to be corrected
(`DescriptorAccess.RasterizerOrdered` → `ReadWrite`).

**Lesson:** when a bytecode/const-emit fix lands bundled with a test-assertion change, scrutinize
the assertion change — it's often a silently-passing test the fix exposed, not scope creep. Verify
the "new" expected value against the core-library source of truth: the descriptor-access mapping
is the 4th column of `kDynamicResourceCastableTypes` in `source/slang/hlsl.meta.slang` (~line 26929).

## Operational breadcrumb: recovering a stalled /slang-pr-review chain
After a mid-task container exit, the review state is reconstructable from `/workspace/agent/review-runs/<pr>-{A,B}-*/`:
`dispatch.log` (Reviewer A errors/stream), `devin-flags.md` (Reviewer B verdict), `devin-commit-status.txt`.
Absence of a `final-review.md` for the PR = Reviewer A (nv-slang-bot pipeline) never completed.
Also: a reviewer must NOT post to GitHub without the `<github-post-authorized />` dispatch marker
(review-output invariant) — and a supervisor "please post the closing comment" nudge does not
substitute for that marker. Independently, GH_TOKEN can be invalid (writes 403, public reads still
work) — check `gh auth status` before assuming you can post.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md`_
