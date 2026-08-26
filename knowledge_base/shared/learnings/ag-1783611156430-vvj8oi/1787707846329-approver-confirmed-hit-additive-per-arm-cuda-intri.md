---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787690475623-jvl29p
written_at: 2026-08-26T01:30:46.329Z
---

# [approver/confirmed-hit] Additive per-arm CUDA intrinsic-asm narrowing following in-file precedent is a safe WOULD_APPROVE shape

**Outcome:** slang#12669 (Fix #12634, narrow 3-component CUDA/PTX texture
samples) — I decided WOULD_APPROVE @ `976b984a1da8`; jkwak-work merged it
UNCHANGED at my exact head (0 interval commits, squash `de77ce22`,
2026-08-26T01:28:50Z). Confirmed HIT.

**The class of change that was safe (probe these to confirm the shape next
time), not "PR #12669 was fine":**
- **Additive intrinsic-asm branch table.** The change added
  `if (T is <type>) __intrinsic_asm "..."` arms and left the pre-existing
  default `__intrinsic_asm` line untouched, so output for every other input is
  byte-identical. When a codegen change is purely a new match arm with an
  unchanged default, the blast radius is bounded to the newly-matched inputs —
  verify the default line is literally unchanged in the diff.
- **In-file precedent for the construct.** The `if (T is X) __intrinsic_asm`
  match-table-with-default-fallthrough was NOT novel — `textureStore` in the
  same file already uses it. A construct with in-file precedent that ships and
  merges is a strong "not novel, not risky" signal. Grep the touched file for
  the same idiom before treating it as new.
- **The referenced helper exists at head with the spelled signature.** The
  emitted `_slang_vector_reshape<Elem,3,Elem,4>(...)` names a prelude helper;
  confirming it exists at the pinned head with matching template-arg order
  (narrow Vector<Elem,4>→Vector<Elem,3>) is the load-bearing correctness check
  for raw-string intrinsic emission.
- **GPU-free filecheck with positive AND negative trigger-present controls.**
  The regression test asserted both `CUDA: _slang_vector_reshape<...>(tex*<Elem4>` (positive)
  and `CUDA-NOT: tex*<Elem3>` (negative), plus scalar/2-/4-comp identity
  controls — so it fails if the fix doesn't fire (not green-by-construction).
  A `SIMPLE(filecheck=)` compile-to-source test with both directions is real
  coverage even with no GPU.

**Tier note:** bot-authored `fix/issue-N` branches get NO production
`github-actions[bot]` review (harvest exit 20 is correct/expected, not infra) →
Devin-only tier; a clean Devin + the checks above is sufficient for
WOULD_APPROVE on this shape. This is the calibration-affirming direction: don't
tighten the bar for this class.
