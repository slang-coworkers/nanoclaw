---
type: chain
title: slang#13108 — CUDA by-value struct arg copies an unread large array
description: External enhancement (missed optimization), P2. HANDED OFF 10-12 to minco3's draft PR #13583 (Closes #13108), which implements tangent-vector's cross-target field-promotion pass. No bot PR; the operator fixer decision is moot. Maintainers (assignee jkwak-work leans downstream) decide on the PR.
tags: [slang, cuda, nvrtc, ir, transform-params-to-constref, optix]
---

# slang#13108 — by-value struct arg copies an unread large array

Reporter **minco3** (external). Canonical thread `gh-issue-shader-slang/slang-13108`. Owner: slang-triager (handed off to contributor PR #13583).

## Facts (verified on GitHub)

- Copy is created by `transformParamsToConstRef::updateCallSites`, which makes a whole-struct temp before a `[noinline]` call. SPIR-V and Metal emit the same copy (per the triager).
- **-O3 → NVRTC** (jkwak-work, 5956995196): Slang does not forward `-O<n>`. The NVRTC switch at `slang-nvrtc-compiler.cpp` has been commented out since #1151. NVRTC has no `-O` option anyway. PTX is identical at -O0 and -O3 (8208 B frame); removing `[noinline]` makes it 0 B. NVVM removes the copy only when the callee reads 3 fields or fewer. Side note, not filed: `-O0` isn't honored downstream either.
- **tangent-vector** (5957317164): wants one IR pass for all GPU targets that narrows large struct params, both by-value (#13108) and pointer (#13177). That is the triager's Approach B, widened.
- **jkwak-work** on #13177 (10-06): says this optimization belongs in the downstream compiler, and Slang should fix only what blocks it. The maintainers disagree on direction.
- Triager reply posted: 5957580557 (10-02). Memo: triager `memory/issues/triage-13108.md`.
- **10-09 minco3** (6089047517): their workload's copies survived only because NVRTC's inliner size budget kept the helpers from inlining. They're following up with the NVRTC team. They closed draft PR **#13110** (unmerged), and on #13177 they closed **#13178** (unmerged). The `[noinline]` repro is still a real missed optimization, so the issue stays open. The one remaining Slang-side piece of #13177 is PR #13115 (static const struct tables).

## State

- HELD, no fixer dispatched. Decision open on orchestrator-dashboard: keep held, or authorize a slang-fixer draft PR for the pass. My recommendation after 10-09: keep held, because there's no workload driving it and the maintainers haven't agreed on Slang vs downstream.
- 10-09: triager `[Resolution]` received (no GitHub post). Re-check confirmed the reporter's explanation: removing `__noinline__` from the emitted CUDA lets NVRTC 12.6 inline `readFields_0`, and the frame drops to 0. The 4-/9-field cutoff is a separate mechanism (argument promotion behind an explicit `__noinline__`, which needs no-alias and was seen only up to 3 fields). Both mechanisms point to the same Slang-side copy whenever the callee stays outlined.
- Issue assigned to **jkwak-work**, the maintainer who leans toward a downstream fix (#13177 cmt 6026301449); labels cuda/reproduced/Office-Tess. Resume on a maintainer decision about which layer owns the fix, or on a substantive human comment.
- Separate chain: bot draft #13115 (Closes #13107, static const struct tables) is idle since 09-16 and tracked by `chase-13107-design-direc-1be8`.
- **10-12 minco3** (6134454346, no bot @-mention): opened **draft PR #13583** (`minco3:minco3/large-param-field-promotion`, +820/−0, 4 files, Closes #13108). It promotes large aggregate in-params to just the fields read through field and constant-index accesses, on all targets. It skips functions whose signature can't change and also promotes params that are only forwarded to a promoted callee. Repro PTX local memory drops from 8208 to 4104 B (the remaining 4104 B is the inout `original`). Size cutoffs are a first guess. At 23:17Z: no reviews, only a coderabbit comment. The bot's review triggers when the PR goes ready-for-review; the approvers are paused.
- 10-12 triager `[Resolution]` (memo §Update 2026-10-12; a skim, not a review): head a1291eab7f. New `promoteParamFields` pass at -O≥1, placed before the target switch that holds both `transformParamsToConstRef` call sites. It covers **in-params only**: the #13177 pointer-param half is NOT covered. It adds no write-back, so it avoids the IgnoreHit hazard. Cutoffs: aggregate ≥64 B, promoted fields ≤½ of it, ≤16 params. Reviewer checks: the layer decision; the cutoffs; skip-list gaps (autodiff, OptiX callables, debug info, module-IR boundary); callee-first order on recursion; `getSize` per target; signature changes on HLSL/SPIR-V/Metal; dynamic-index reads still copy everything; overlap with #13115 and #12620.
- With a contributor PR in flight, the operator's keep-held vs fixer decision is moot: a fixer PR would duplicate it.
- **10-13 jkwak-work** (6154380929, @nv-slang-bot): asked whether a legalization pass that turns read-only by-value params into references already exists, and if so why it applies to this case. Dispatched to the triager with post authorization. The triager answered in **6154858345**, checked at master 584103334 with IR dumps:
  - (a) Yes, the pass is `transformParamsToConstRef` (emit.cpp:2500 for CUDA/CPU/Metal, :2486 for SPIR-V), and it does apply: the callee gets `State_0*`. `updateCallSites` (:213-255) passes the address through only for a constant-buffer, parameter-block or borrow-in root (`isLoadFromImmutableAddress` :186-210). Otherwise it copies the whole struct into a temp (:243-246).
  - (b) In the repro the temp is **required**. SSA folds `captured` into `load(original)`, and `original` is also the `inout` arg the callee writes before reading `snapshot.a`. Passing `&original` gives 23 instead of 16. The only waste is copying `unused` too.
  - The temp is conservative when `captured` is a distinct, unmodified local. Hand-passing `&captured` takes the frame from 11432 B (3112 B spills) to 8208 B (no spills).
  - Options offered, not recommended: (1) skip the temp for an unmodified, non-escaping, non-aliased local root; this does nothing for the repro. (2) `__restrict__` on the param takes the frame 8208 → 4104 B, but needs a general aliasing guarantee, and NVVM stops promoting at ≥4 fields read.
  - #13583 is mentioned only as the alternative. Chain stays handed off.
- Re-chase: `rechase-13108-noinline-p-c69e` (2026-10-16), repurposed to watch #13583. The earlier `rechase-13108-field-prom-1f13` ran and is gone.
