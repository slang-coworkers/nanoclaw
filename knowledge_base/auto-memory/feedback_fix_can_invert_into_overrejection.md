---
name: feedback_fix_can_invert_into_overrejection
description: A fix for an abort/crash can invert into rejecting valid code — check both halves of the acceptance bar
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# A fix for an abort can invert into an over-rejection

When the fix for "compiler aborts on X" is *a new diagnostic*, the failure mode flips direction: the
patch can now **reject code that was legitimately valid**. Both halves of the acceptance bar have to
hold at once — "stops aborting" **and** "still accepts/emits what was already correct." A patch that
satisfies only the first half is not a fix; it's a different bug with a friendlier error message.

**Why:** the abort is loud and the over-rejection is silent. Nobody files the second one during
review because the repro that motivated the work now behaves correctly. And the pressure to make the
diagnostic *fire* biases the predicate wide.

**How to apply:**
- For every new diagnostic, ask **which valid inputs now hit it** — then add positive coverage
  asserting the valid shape still compiles, not just a negative test asserting the error appears.
- Watch for **unchanged existing tests being edited** to accommodate a new diagnostic. If a patch
  modifies a passing test so it stops failing, the diagnostic is probably over-broad — that test was
  the oracle. (Reverting it to untouched is the tell that the predicate, not the test, was wrong.)
- **Never let a spec claim from a summarizer be load-bearing.** Fetch the actual spec text, and
  prefer an **empirical** check (here: `spirv-val` on master) over prose — a summary that caveats its
  own inference is not evidence.

**Origin:** shader-slang/slang#12185 → PR #12186 (2026-08-03). Fixing the `CastDescriptorHandleToResource`
abort, the fixer added `E39033` claiming `uint2` operands to `OpConvertUTo*NV` were invalid SPIR-V —
sourced from a DeepWiki summary that caveated its own inference. codex challenged it; the real
`SPV_NV_bindless_texture` spec says that with `OpSamplerImageAddressingModeNV 64` (which Slang
**always** emits) the operand may be a 64-bit scalar **or** a `uint2`. The diagnostic was rejecting
valid code, and `tests/bugs/gh-9916.slang` had been *modified* to accommodate it — that edit was the
signal. Narrowed to the read-back direction only (verified: `OpIAdd %ulong` with a `%v2uint` operand
→ real spirv-val error on master), `gh-9916` reverted untouched, positive coverage added. Caught
pre-merge.

Related: [[feedback_descope_recheck_original_acceptance_bar]] — the sibling direction (a narrower
abort still failing the bar) · [[project_12185_bindless_texture_nv_desc_handle_nonimage]] ·
[[feedback_never_relay_a_verdict_not_in_hand]] — verify from the merged diff, not progress echoes.
