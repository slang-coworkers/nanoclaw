---
title: "SlangPy Tests 'undefined identifier 'MatrixLayoutMode'' is a pre-existing slang↔slangpy break, not your PR"
type: learning
topic: slang-compiler
source: learnings/1789151049950-slangpy-tests-undefined-identifier-matrixlayoutmod.md
---

# SlangPy Tests "undefined identifier 'MatrixLayoutMode'" is a pre-existing slang↔slangpy break, not your PR

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788553667167-6aleti
written_at: 2026-09-11T18:24:09.950Z
---

# SlangPy Tests "undefined identifier 'MatrixLayoutMode'" is a pre-existing slang↔slangpy break, not your PR

When a shader-slang/slang PR's only red CI check is **"SlangPy Tests"** and the failure is `error[E30015]: undefined identifier 'MatrixLayoutMode'` at `slangpy/slang/staticarray.slang:10:55` (cascading to `E39999 import of module 'slangpy' failed` → the sgl reflection test `tests/sgl/refl/test_lookup.cpp` throws "Failed to load slang module 'slangpy'" → job exits 1), it is a **pre-existing slang-core-module ↔ SlangPy version mismatch**, NOT caused by your change.

Evidence pattern (observed 2026-09-11): the identical failure reproduced on THREE unrelated Slang PRs simultaneously — #12912 (diagnostics loc fix), #12915 (autodiff DifferentialPair), #12910 (Metal emitter). `staticarray.slang:10` is `public extension<T, let R:int, let C:int, let L:MatrixLayoutMode> matrix<T,R,C,L> : ISizedArray<...>` — SlangPy references the core-module symbol `MatrixLayoutMode` (4th generic param of `matrix`), which isn't exported in the Slang build the `ci-latest-slang` workflow compiles for that PR's base.

Triage guidance:
- Do NOT treat it as your bug or as flaky. A `gh run rerun` won't help — it's deterministic on the branch's Slang base.
- Do NOT rebase an already-approved PR just to chase it: rebasing force-pushes and dismisses the maintainer's approval. It depends on the base each branch carries; some later same-window runs (branches on a newer base) passed.
- Report up that the red "SlangPy Tests" check is unrelated/pre-existing and shouldn't block the merge; the real fix is in slang↔slangpy integration (align `MatrixLayoutMode` availability).
- Distinguish from a real failure by the diagnostic code + file: E30015 name-resolution in slangpy's OWN module ≠ anything your Slang diff touches.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789151049950-slangpy-tests-undefined-identifier-matrixlayoutmod.md`_
