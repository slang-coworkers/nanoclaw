---
type: issue-chain
title: slang#14732 — ParameterBlock base/reserved space offset compiler option
description: Feature request triaged 11-26, parked for maintainer direction on 4 design decisions; sibling of #14730
---

# slang#14732 — Add ParameterBlock Offset / Reserved

- **Human-filed 11-26 12:28Z** (aka0353, no labels). Feature request: a compiler option
  (e.g. `ParameterBlockBaseSpace` / `ReservedSpaceIndex`) to offset/pre-reserve register
  spaces before auto-binding in `generateParameterBindings()` — so one shader codebase
  works across non-bindless (sets 0–3) and bindless/hybrid (set 0 = global descriptor
  arrays, ParameterBlocks at sets 1–4) pipelines without per-block `[[vk::binding]]`/spaceN
  annotations. Also cross-stage (VS/PS) layout consistency.
- **Triaged 12:34Z** (slang-triager, dispatched same minute as the webhook; 👀 reaction
  691174974): feature-request / low / P3 / frontend (layout-and-binding). Not a dup —
  related-not-dup: **#14730** (same author, the bindless-space-index preemption bug,
  sibling chain FIX-HELD-ON-MAINTAINER), #6801, #8441, #12349. `-fvk-shift-*` only shifts
  bindings within a set (Vulkan-only); `-bindless-space-index` reserves only its own space.
- **Recommended approach A:** `ParameterBlockBaseSpace` (int, default 0) mirroring
  `BindlessSpaceIndex` plumbing end-to-end; reserve `[0, base)` in `usedSpaces` at the top
  of `generateParameterBindings` (slang-parameter-binding.cpp:4459) + relax the
  `defaultSpace == 0` assert (:4750). Target-neutral, base 0 byte-identical, ABI-safe
  (CompilerOptionName enum append = 166 pre-`CountOf`). Other files: slang-options.cpp:991/:4603,
  include/slang.h:1164/:1380.
- **PARKED for maintainer direction** — 4 design decisions need sign-off: (1) scope incl.
  $Globals?, (2) hard-vs-soft reserved range, (3) composition with `-bindless-space-index`,
  (4) naming. GitHub artifact on the issue (cmt 7192180014, 5-bullet + bot disclaimer);
  Issue Type set to Feature; one-shot recheck `recheck-14732-park-00e5` fires 2026-12-03.
  Triage memo: raw inbox `a2a-1795696486914-o45wip/triage-14732.md`.
- **Cross-chain note:** approach A would resolve the #14730 collision class by construction
  — mention it if the #14730 maintainer review (cmt 7187704180) surfaces the option ask.
- No fixer until maintainer picks; resume on issue comment webhook or the recheck timer.

## Citations
- Issue: https://github.com/shader-slang/slang/issues/14732
- Triager report (this conversation, msgs 10/12, 11-26 12:34Z)
- Sibling: [14730-bindless-space-index-preemption.md](14730-bindless-space-index-preemption.md)
