---
type: chain
title: slang#13518 — MemoryOrder validation (draft PR #13541)
description: Missing diagnostic for invalid constant memory orders on Atomic<T> ops; held on maintainer Q1/Q2
tags: [slang, spirv, metal, atomics, held-on-maintainer, parked]
---

# slang#13518 — invalid `MemoryOrder` not diagnosed

- **Issue:** https://github.com/shader-slang/slang/issues/13518, labels Missing Diagnostic / reproduced / SPIR-V.
  Triage cmt 6059782185 (10-08); PR-opened cmt 6076770596 (10-09).
- **Assignee:** @jkwak-work (took it over from kaizhangNV on 2026-10-12, milestone Q4 2026 (Fall)). The PR's review request still points at @kaizhangNV.
- **PR:** DRAFT #13541 (`fix/issue-13518`), Approach A: an IR check after constant folding. E41405/E41406 apply to all targets; E41407/E41408 apply to SPIR-V and non-texture Metal.
  Head `f961d32f0b` (10-12), label `pr: non-breaking`. As of 10-26 it is `DIRTY` (merge conflict, 6 ahead / 99 behind master).
- **Internal pipeline: done.** Triager posted [Triage Resolution] on 10-12. The slang-reviewer round-2 verdict was APPROVE_WITH_NITS (0 bugs, 5/6 nits folded).
  Triager session `sess-1791458093751-94rxzh` (thread `gh-issue-shader-slang/slang-13518`).
- **Merge blockers (maintainer):** Q1 asks whether invalid orders are errors or warnings; if errors, the label flips to `pr: breaking change`. Q2 asks whether to reject or allow `compareExchange(Release, Acquire)`.
- **CI:** the head has had ZERO check-runs and Actions runs since at least 10-20 (re-verified 10-26). The old falcor-ci-waiting run 38188084175 is gone. If a new run is `waiting` on falcor-ci, a `ci-approvers` member must approve it.
- **#13724 precedent (not an answer):** E39033 merged 10-20 as `pr: breaking change` after jkwak-work's code-shape-only review. This does not answer Q1 for memory orders, or Q2.
- **Operator ask:** ping-or-wait decision (a/b/c) sent 10-20 (dashboard row 506256), reminded 10-23 (row 507646). No reply as of 10-26 12:30Z (checked dashboard rows back to 10-22 18:23Z).
- **PARKED 2026-10-26 (re-chase #5, final).** No timer. Webhooks wake it: a maintainer comment on #13518/#13541, a review, or a draft→ready flip. If the operator later picks (a) or (b), dispatch merge-master to slang-fixer first (merge, not rebase), then (a) the triager pings @jkwak-work with Q1/Q2 verbatim from the PR body.
- **Coupling:** for #13519 (SeqCst A/B), the SeqCst mapping must stay inside #13518's valid set, and #13541 has to see the orders before they are downgraded.
- **Deliberately unfiled:** nit 6 (order-less atomics on SPIR-V/Metal, pre-existing). Revisit it once Q1 has settled the severity policy.
- **Timer:** none (parked). The five one-shot re-chases (10-12 → 10-26) logged to `tasks/rechase-13518-memorder-q-*.md`; the last was `-4dfe`.
