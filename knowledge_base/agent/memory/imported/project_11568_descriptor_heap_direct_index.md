---
name: project_11568_descriptor_heap_direct_index
description: "slang#11568 direct-index ResourceDescriptorHeap — TERMINAL: PR #11798 squash-merged 2026-07-11 (84792eb15f). Design: non-generic UntypedResourceHandle/UntypedSamplerHandle builtins (generic __subscript -> DescriptorHandle<T> is uninferable, E39999) lowered to uint before emit per csyonghe's invariant. Took 3 fixer sessions (autocompact thrash → infra error → recovery-2 landed). The 'missing k_maxSupportedModuleVersion bump = forward-compat hazard' alarm was overstated: k_min/k_max are advisory only (see #12157)."
metadata:
  node_type: memory
  type: project
  originSessionId: 5324107a-53f8-4242-9a16-17fbfc0a8f64
---

# slang#11568 — direct-index `ResourceDescriptorHeap` (merged)

**Outcome:** PR **#11798** squash-merged by jkwak-work 2026-07-11 00:43Z (merge `84792eb15f`); issue
CLOSED/COMPLETED. Issue verdict cmt 4819877983. Worktree reaped. Related:
[[project_12051_descriptor_reuse_pinning]].

## Design

- jkwak first asked (06-27 webhook) to base a PR on #11723; triage correctly redirected — #11723 is
  backend SPIR-V stride only, no shared surface. jkwak accepted (cmt 4819867103).
- **Blocker:** generic `__subscript(uint) -> DescriptorHandle<T>` is uninferable (E39999) —
  `OverloadResolveContext` has no expected type (`slang-check-overload.cpp:3082`).
- **csyonghe's design:** new builtins `UntypedResourceHandle` / `UntypedSamplerHandle` returned
  non-generically, plus implicit conversions reusing `kIROp_CastDescriptorHandleToResource`;
  `[require(glsl_hlsl_spirv_wgsl, descriptor_handle)]` on all 4 conversions (codex caught a Metal
  guard-bypass). Stable names 892–897.
- **csyonghe's invariant (review 07-09, `slang-emit-c-like.cpp` / `slang-emit-spirv.cpp:2712`):** the
  untyped handle must never reach emit. Implemented as an unconditional
  `lowerUntypedResourceHandleToUInt` pass in `linkAndOptimizeIR` (after simplification, before
  emit/layout, so `-O0` is covered; gated by `RequiredLoweringPassSet.untypedResourceHandle`) that
  forwards the 4 Cast{UInt↔Untyped*Handle} ops and rewrites the 2 handle types; HLSL / SPIR-V /
  IR-layout sites now `SLANG_UNEXPECTED` on a survivor. New `-O0` regression
  `desc-heap-direct-index-o0.slang`.
- Tests: HLSL/SPIR-V/GLSL/WGSL positives, E30019 heap-family mismatch, E36107 Metal guard; jkwak's review
  round added `-target dxil` and GLSL-via-glslang checks and trimmed ad-hoc "Family-1/2" comment terms.

## Recovery saga — the reusable lessons

The invariant work was written on disk, then the fixer session died of **autocompact thrash** (~890K
context, re-filled by review/thread-resolve webhooks) before pushing; jkwak's "address Yong's comments"
(cmt 4930113464) sat unanswered ~22.5h until the operator flagged it.

- **Restart ≠ fix for a thrash death** — resume reloads the bloated transcript. Needs a fresh session.
- **Never `ncl groups restart` the fixer group** to revive one chain — it kills every live sibling fixer
  session. Use a targeted wake.
- **Dispatch the fresh session on an append-only sub-thread** (`gh-issue-shader-slang/slang-11568/recovery`),
  not the canonical thread, where the dead session is still routing-active. (These sub-thread keys later
  tripped scan.py — [[project_supervisor_scan_malformed_subthread_key_false_escalate]].)
- recovery-1 died on a one-turn infra error; recovery-2 compacted twice at ~870K without pushing — that
  was a legitimate long rebase + DXC-from-source rebuild, not death. **Don't pre-empt a live session on
  "no push yet";** a watcher's head-unchanged deadline is only a death signal if liveness is unknown.
  Waking a third session would have been the co-driver clobber trap.
- recovery-2 pushed `4465500b1e` (rebased) 07-10 22:12Z and replied to both csyonghe threads + jkwak
  (`issuecomment-4939959350`). The post-push/pre-reply gap is where the chain died before — watch it.

## Version-counter follow-up (resolved as non-hazard)

slangbot's IR-version check flagged that ops 892–897 shipped with `k_maxSupportedModuleVersion` still 25
(the fixer's 25→26 bump was uncommitted at squash time). I surfaced a follow-up PR to the operator twice
(07-11, 07-12) as a forward-compat hazard; no reply, no PR opened. **That framing was overstated:**
[[project_12157_ir_version_check_required_status]] proved k_min/k_max are advisory only — the deserializer
never compares the loaded `m_version` to them; real back-compat is the stable-name system +
`_foundUnrecognizedInstructions → SLANG_FAIL`. The counter was later bumped 25→26 by #12133 anyway.
Nothing to resume.
