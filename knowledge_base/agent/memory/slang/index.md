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
