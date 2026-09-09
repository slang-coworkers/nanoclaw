---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786543419919-7rqff1
written_at: 2026-08-12T14:47:30.952Z
---

# [approver/challenger-calibration] VM-emit missing-constant fix: a bundled test-assertion change is un-masking, verify vs core-module source not scope-creep

**Symptom:** A slang-emit-vm fix that adds a missing `kIROp_*Lit` arm to
`ByteCodeEmitter::addConstantValue` (the #11375/#11379/#11398/#11402 class) can
legitimately bundle an *unrelated-looking* test-assertion change. On PR #11398
the BoolLit fix also flipped `desc-handle-4.slang`'s expected
`RasterizerOrderedStructuredBuffer` descriptorAccess from `RasterizerOrdered` to
`ReadWrite`. That reads like scope creep at first glance.

**Root cause:** The missing-constant bug makes the VM constant section
under-filled, so a `bool`-returning CHECK path propagates a *garbage-truthy*
value. A pre-existing test can then pass **for the wrong reason** — both the
`== RasterizerOrdered` (wrong) and the correct branch evaluate truthy against
garbage. Adding the constant arm un-masks the test, forcing the assertion to be
corrected to its real expected value. The bundled change is a *consequence of
the fix*, not extra scope.

**How to catch it (transferable probe):** When a VM/bytecode missing-constant
fix bundles a changed expected value in an existing test, do NOT dismiss it as
scope creep and do NOT trust that "it passes now" — the *new* value must be
verified against the source-of-truth, because the *old* value was the
masked-wrong one. For descriptorAccess this is `hlsl.meta.slang`'s
`kDynamicResourceCastableTypes` table (PR #11398: line 27393 maps
`RasterizerOrderedStructuredBuffer<T,L>` → `"ReadWrite"`, and :27425 sets
`descriptorAccess = DescriptorAccess.$(access)`). General rule: **an assertion
change bundled with a masking-bug fix is un-masking; audit the NEW value against
the core-module/spec source, not against the test's own new pass/fail state.**

**Also confirmed safe on this shape (for Step-0 recall):**
- BoolLit arm correctness = writes `sizeAlignment.size` bytes via a widened
  `int64_t` (mirrors the IntLit arm), NOT `sizeof(bool)`/1 — the 1-byte write is
  what reproduces the OOB. `SLANG_ASSERT(size <= sizeof(int64_t))` bounds it.
- A `default: SLANG_UNEXPECTED` arm over IRConstant is a *live* guard, not dead
  code / not future-proofing: the `Constant` block in `slang-ir-insts.lua`
  (:936-948) is Bool/Int/Float/Ptr/Void/String/BlobLit; the switch covers all
  but BlobLit, which VM emission genuinely does not support — so the guard
  cannot fire on a valid VM path and exists precisely to fail loudly instead of
  leaving an unbacked slot (the #11375 bug).

**Outcome:** WOULD_APPROVE, agreed with human approver jvepsalainen-nv. Tier was
Devin-only (bot-authored `dev/slang-fixer/` branch ⇒ production review genuinely
skips ⇒ harvest exit 20 is expected, NOT an abstain).
