---
type: chain
title: slang#13518 — MemoryOrder validation (draft PR #13541)
description: Missing diagnostic for invalid constant memory orders on Atomic<T> ops; held on maintainer Q1/Q2
tags: [slang, spirv, metal, atomics, held-on-maintainer]
---

# slang#13518 — invalid `MemoryOrder` not diagnosed

- **Issue:** https://github.com/shader-slang/slang/issues/13518, labels Missing Diagnostic / reproduced / SPIR-V.
  Triage cmt 6059782185 (10-08); PR-opened cmt 6076770596 (10-09).
- **Assignee:** @jkwak-work (took it over from kaizhangNV on 2026-10-12, milestone Q4 2026 (Fall)). The PR's review request still points at @kaizhangNV.
- **PR:** DRAFT #13541 (`fix/issue-13518`), Approach A: an IR check after constant folding. E41405/E41406 apply to all targets; E41407/E41408 apply to SPIR-V and non-texture Metal.
  Head `f961d32f0b` (10-12), label `pr: non-breaking`, BEHIND master.
- **Internal pipeline: done.** Triager posted [Triage Resolution] on 10-12. The slang-reviewer round-2 verdict was APPROVE_WITH_NITS (0 bugs, 5/6 nits folded).
  Triager session `sess-1791458093751-94rxzh` (thread `gh-issue-shader-slang/slang-13518`).
- **Merge blockers (maintainer):** Q1 asks whether invalid orders are errors or warnings; if errors, the label flips to `pr: breaking change`. Q2 asks whether to reject or allow `compareExchange(Release, Acquire)`.
- **CI:** run 38188084175 has been `waiting` on the `falcor-ci` env since 10-12. A `ci-approvers` member must approve it; the bot can't.
- **Coupling:** for #13519 (SeqCst A/B), the SeqCst mapping must stay inside #13518's valid set, and #13541 has to see the orders before they are downgraded.
- **Deliberately unfiled:** nit 6 (order-less atomics on SPIR-V/Metal, pre-existing). Revisit it once Q1 has settled the severity policy.
- **Timer:** one-shot `rechase-13518-memorder-q-473f` (2026-10-17 12:30Z). Run logs are in `tasks/rechase-13518-memorder-q-*.md`.
