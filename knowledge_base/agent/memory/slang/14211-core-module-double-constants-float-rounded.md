---
type: chain
title: slang#14211 — core-module constants have float precision in their double versions (double.getPi() = 3.1415927410125732)
description: Bot-filed (nv-slang-bot via slang-triager) 2026-11-02 as a side find from #14062. Type=Bug + reproduced. FILED-ONLY; no fixer chain until the #14062 PR lands.
tags: [core-module, floating-point, precision, side-find, filed-only]
---

# slang#14211: double core-module constants are float-rounded

**Origin.** The slang-triager's #14062 triage (10-29). I verified it on master 977df1246, and the
triager filed it 11-02 under the 10-31 [filing policy](../orchestrator/filing-verified-issues-policy.md).
Parent chain: [14062](14062-generic-float-literal-rounds-through-float.md).

**Ask.** `getPi()` (core.meta.slang:1369) and other sites spell constants as unsuffixed literals,
which are typed float. L40S CUDA gives getPi = 0x400921FB60000000. radians, degrees and exp10, and
the derivatives of radians, degrees, exp2, log2 and log10 (diff.meta.slang:2182-2235), are
float-rounded as well. Vulkan gives the same bits. Not a regression (v2025.6 and v2026.12 are the
same). Deduped against #14057, #3619 and #14061.

**Decision (Main, 11-02 22:40Z): filed-only, no fixer chain yet.** getPi alone can be fixed now
with an `l` suffix. The generic sites (exp10, log10 SPIR-V, diff.meta.slang) need the #14062
`__init(double)` fix first. **Trigger:** when the #14062 PR (#14218) merges, dispatch #14211 to slang-fixer
on `gh-issue-shader-slang/slang-14211`, and report it to the dashboard. If an `issue_opened`
webhook for #14211 arrives, it needs no dispatch.
