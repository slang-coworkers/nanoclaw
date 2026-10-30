---
type: chain
title: slang#14053 — overloaded same-name `[shader("compute")]` entry points emit invalid CUDA/Metal/SPIR-V with no diagnostic
description: Human-filed (albertrodriguezclo) bug 2026-10-29 21:51:27Z, cloth-sim batch. Triaged bug/medium/P2, reproduced, fixer-ready (approach C, link-time target-aware name check). Fixer HELD until R6 (#14033 precedent); triager one-shot i14053-r6-post-b43c 2026-11-02 22:00Z posts + hands off.
tags: [entry-points, diagnostics, cuda, metal, spirv, bug, r6]
---

# slang#14053 — overloaded entry points with the same name

**Ask.** Two `[shader("compute")]` overloads of `Count` (different params) compile with exit 0 on
cuda/metal/spirv (reporter: master 43ac12323). Each target's output is invalid: duplicate `extern "C"`
kernels (nvcc), duplicate mangled name (metal), two `OpEntryPoint ... "Count"` (spirv-val).
Reporter wants a front-end diagnostic (or deterministic renaming that reflection reports).
**Secondary ask:** a default value on an entry-point param (`uniform int* flag = nullptr`) is silently
dropped; they want a warning. This is a separate concern and may warrant a split (maintainer call).

**GitHub state (10-29 21:5xZ).** 0 comments, no labels, no assignee. No `bot-ok`, no crash word → **R6
applies: no bot comment before 2026-11-02 21:51:27Z.** Not a follow-up of any existing chain
(`grep 14053 memory/` had no hits; the only session on the thread was my own webhook session).

**Triage (slang-triager, 10-29 22:14Z; memo `/workspace/inbox/a2a-1793312045725-4wby3h/triage-14053.md`).
These are the triager's findings; I verified only the GitHub state.** Reproduced on v2026.20-77 (L40S). Not a regression
(2026.13.1 behaves the same). The bug is wider than overloads: `A::K`/`B::K` in two namespaces collide too, and DXIL/WGSL
collide as well. Nothing checks uniqueness (discovery slang-module.cpp:337, lowering slang-lower-to-ir.cpp:15328).
`-entry Count` with overloads gives a misleading E38000 (`findFunctionDeclByName` drops the `OverloadedExpr`,
slang-check-shader.cpp:933). A vs+fs `Main` overload is valid SPIR-V, so the rule must be target-aware.
Options: A front-end error (breaks API users compiling one overload); B rename (no, #13264); **C (rec.)**
a link-time error in `checkEntryPointDecorations` (slang-ir-entry-point-decorations.cpp:25): SPIR-V = name + execution model,
other targets = name. Plus an `-entry` ambiguity error. Related: #13882 (tangent-vector's entry-point identity redesign),
#12392/#12721, #7473, #13264. Default-value warning: independent; split is a maintainer call, nothing filed.

**GitHub (verified by Main 10-29 22:1xZ).** Type=Bug, label `reproduced`, 0 comments, no assignee.
The reporter has ≥10 open self-PRs (#13930–#14022).

**Main decision (10-29 22:1xZ): hold the fixer until R6 elapses (#14033 precedent).** Reason: the reporter often self-PRs, and a
bot PR would cross-reference the issue during the hold. The triager's one-shot **i14053-r6-post-b43c (2026-11-02 22:00Z)**
does three things. (1) If a reporter or human PR exists, it stands down and reports. (2) If a maintainer replied, it posts a
delta and follows their direction. (3) Otherwise it posts the 5-bullet (C recommended, A/B noted, default-value split offered)
and sends the [Triage handoff] for C to slang-fixer; the PR must cite #13882. Triager confirmed 22:16Z that the order is in the task prompt verbatim (check order 4→1→2→3). Owner: slang-triager, thread `gh-issue-shader-slang/slang-14053`. Next touch: the one-shot report on 11-02 at 22:00Z.
