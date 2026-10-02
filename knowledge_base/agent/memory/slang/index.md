---
type: index
title: Slang / slang-rhi chain records
description: Per-chain records for shader-slang issue and PR work driven through this orchestrator
---

# Slang chains

Per-chain state for shader-slang work. One file per issue/PR chain; open the file before
acting on a chain — these hold verified receipts (shas, job ids, log line numbers) that
decay and must be re-read, not remembered.

## Map

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  re-pushed 10 times. R10 (`14a2185f`) is only a master merge, so I held it. The R9 real commit was never decided: the approver session has been in cost escalation since Sep 14, and its dispatches go unanswered. The ledger is also unset. All of this is with the operator; re-chase `rechase-12136-approver-c-c050` (2026-10-04).

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed and left unrouted; CI + #13355 go/no-go are with the operator. Re-chase `rechase-13350-13355-d86c` (2026-10-02).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer and CHANGES_REQUESTED. HELD until the #13339 Ref-split PR lands (jhelferty-nv 10-01: implement on #13339); then it rebases with its P1 fix. Was held on who implements the
  `ParameterPassingMode` Ref split (it would subsume 84fa791 and conflicts with their #13232).
  Re-chase `rechase-11709-constref-d-9d86` (2026-10-02).

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; re-chase `rechase-13348-assignee-1a52` (2026-10-07).

- [slang#13346 — note-suppression tracking issue for maintainer PR #13325](13346-note-suppression-tracking.md) —
  WATCH-ONLY. The PR has no Closes-link; re-chase `rechase-13346-close-link-59e9` (2026-10-07).

- [slang#13337 — stray `;` in an interface → E38100 empty-named member](13337-interface-emptydecl-requirement.md) —
  triaged + reproduced. The `checkInterfaceConformance` deny-list treats `EmptyDecl` as a requirement.
  The author self-assigned it, so no fixer; re-chase `rechase-13337-assignee-413f` (2026-10-03).

- [slang#13336 — `property override` ICE (decl modifier in a type slot)](13336-override-after-property-ice.md) —
  triaged + reproduced. The `checkTypeModifier` catch-all ICEs on any decl modifier in a type position.
  The author self-assigned it, so no fixer; resumes on a human comment.

- [slang#13332 — second-order crash on a no_diff value; is higher-order supported?](13332-second-order-nodiff-scope.md) —
  owned by fixer `sess-1789716207340-dwbdoz`. jkwak-work says second-order is unsupported (diagnose, don't crash), which
  contradicts the user guide. His answer likely decides the #13320–#13327 family. Re-chase `rechase-13332-2nd-order-ad11`.

- [slang#13319 — conflicting link-time exports, order-dependent pick](13319-conflicting-link-time-exports.md) —
  triaged; linker ambiguity diagnostic never implemented. Fixer HELD pending a maintainer
  error-vs-warning decision; re-chase `rechase-13319-severity-595a` (2026-10-06).

- [slang#13330 — array-of-struct shader IO crashes SPIR-V/GLSL](13330-array-of-struct-shader-io.md) —
  triaged; two legalize-pass defects (write-path void store + overlapping input Locations). Fixer
  HELD: external reporter co-assigned; re-chase `rechase-13330-assignee-c133` (2026-10-06).

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. Maintainer
  mandated an explicit `handOffShared`/`takeOverShared` API; DRAFT PR #881 (head `360bd42`,
  GPU-CI-green, per-test verified) held pending reviewer re-confirm + operator drafts-only lift.
  #812 (register-all) held as the alternative.
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — how the design converged
    (#812 forks, the rejected `IExternalMemoryQueue` sketch) and the codex/maintainer/reviewer rounds
    resolved; settled history kept out of the live parent.
