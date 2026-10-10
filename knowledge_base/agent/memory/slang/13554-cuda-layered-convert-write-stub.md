---
type: chain
title: slang#13554 — CUDA/PTX formatted RWTexture{1D,2D}Array store silently dropped (empty `_convert` prelude stub)
description: External report (minco3), unassigned. Triaged P2 bug, reproduced. Orchestrator GO 2026-10-10 on Approach A, prelude-only inline sust.p.a{1d,2d}, as a draft PR.
tags: [slang, cuda, ptx, rwtexture, prelude, go, draft-pr]
---

# slang#13554 — layered `_convert` surface write is an empty stub

Reporter minco3 (NONE, external), filed 2026-10-09 ~23:11Z, unassigned. Thread `gh-issue-shader-slang/slang-13554`.
Main session `sess-1791587497477-4u2mkp`.

## State

- **Triage** (slang-triager, cmt [6091397893](https://github.com/shader-slang/slang/issues/13554#issuecomment-6091397893), labels
  `reproduced`+`cuda`, Type=Bug): reproduced on master 08d419cbf. `surf{1D,2D}Layeredwrite_convert` stubs at
  `prelude/slang-cuda-prelude.h` ~:1666/:1747 are empty. The store has been silent since v2025.21, when #8863 commented out #8644's
  non-dependent `static_assert(false)`; it never compiled to a working store. A layered `_convert` read is undefined (loud
  NVRTC error), so it is out of scope.
- **GO 2026-10-10 (Orchestrator):** Approach A as a **draft** PR (`Fixes #13554`). Inline `sust.p.a1d`/`sust.p.a2d`, mirroring
  `SLANG_SURF2DWRITE_CONVERT_IMPL`. Tests: a GPU-free PTX FileCheck plus a CUDA runtime test for CI. The ptxas 12.6 prototype
  assembles, but `sust.p.a{1,2}d` is not in the PTX ISA syntax table, so only GPU CI proves the conversion. The triager releases
  the HELD fixer.
- Basis for GO without a maintainer: the issue is unassigned with an external reporter, the change is a prelude-only bug fix,
  a draft PR pre-empts no owner, and #12630 is precedent (the maintainer chose to implement a stub of the same class).

## Coupling (don't fold in)

- #12627 / draft PR #13363 (ours, held on jkwak-work): `getCUDASurfaceAccessInfo` sets `isConversionAvailable = !isLayered` for
  writes (E56007 on the subscript path only). If #13554 lands first, that rule goes stale, so flip it in #13363. Don't edit #13363 from this chain.
- #13364 (jkwak-work, Q1 2027) and #11088 / draft #11090 (skallweitNV; csyonghe + jkwak-work) are human-owned. If #11090 lands
  it replaces this prelude path.
