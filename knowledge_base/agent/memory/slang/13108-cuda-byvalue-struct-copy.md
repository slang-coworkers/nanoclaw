---
type: chain
title: slang#13108 — CUDA by-value struct arg copies an unread large array
description: External enhancement (missed optimization), P2. HELD, no bot PR. Reporter minco3 closed their PRs #13110/#13178 on 10-09 (root cause in their workload is NVRTC's inliner budget). Issue stays open for the [noinline] case. Maintainers split on Slang IR pass vs downstream; the assignee (jkwak-work) leans downstream. Operator decision open.
tags: [slang, cuda, nvrtc, ir, transform-params-to-constref, optix]
---

# slang#13108 — by-value struct arg copies an unread large array

Reporter **minco3** (external). Canonical thread `gh-issue-shader-slang/slang-13108`. Owner: slang-triager (HELD).

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
- Re-chase: `rechase-13108-noinline-p-c69e` (2026-10-16). The earlier `rechase-13108-field-prom-1f13` ran and is gone.
