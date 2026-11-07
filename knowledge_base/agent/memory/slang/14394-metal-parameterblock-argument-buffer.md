---
type: chain
description: "Human-filed (rope-hmg, external, no labels/assignees) 11-07 01:19Z: on Metal, ParameterBlock<T> emits an argument buffer (`T constant* [[buffer(0)]]`) where the reporter expected flat `[[texture(0)]]`/`[[sampler(0)]]` (to match SDL3). TRIAGED 01:30Z as a question / working as designed (P3); workaround posted (cmt 6700349707); opt-in flatten mode parked on Metal maintainers. No fixer."
resource: raw/triage-14394.md
tags: [metal, parameterblock, argument-buffer, layout, sdl3]
---

# shader-slang/slang#14394 — Metal ParameterBlock emits an argument buffer

**11-07 01:19Z issue_opened → `slang-triager` on `gh-issue-shader-slang/slang-14394`.** R6: no hold. The memory grep on
14394 had no hits, live assignees were empty, and only my own session was on the thread.

- 01:22Z triager ack: reproduced on master. `ConstantBuffer<Test>` flattens; `ParameterBlock<Test>` emits `[[buffer(0)]]`.
- **01:30Z TRIAGED** (master ae4e57957): question / latent feature request, low, Metal emit + layout, P3. Not a bug: the
  Metal argument-buffer mapping is documented in `docs/user-guide/a2-02-metal-target-specific.md:198-229` and implemented
  by `MetalParameterBlock` (`slang-emit.cpp:2064-2079`, `slang-legalize-types.cpp:1308`). No flatten option exists.
  Workaround: a plain global `layout(set = 2, binding = 0) Test test;` gives flat bindings on metal/spirv/wgsl.
  Dedupe: none (nearby #14006/#14007/#14042/#14166/#13900 are different). No `reproduced` label; Type left blank.
- Bot comment 01:29:05Z https://github.com/shader-slang/slang/issues/14394#issuecomment-6700349707 (verified, nv-slang-bot).
- PARKED: the reporter confirms the workaround; Metal maintainers (jhelferty-nv) decide on an **opt-in** flatten mode
  (memo Approach B). Changing the default is rejected. Triager one-shot re-check t-fd0ad5, 11-11 02:00Z (the triager's
  task; `ncl tasks get` from Main cannot see it).

Next: nothing for the bot unless the reporter or a maintainer replies (webhook). If a maintainer asks for Approach B → slang-fixer.
