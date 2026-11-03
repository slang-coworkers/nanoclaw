---
title: "Slang link-time entry-point checks: use LinkedIR::entryPoints, not every IREntryPointDecoration func"
type: learning
topic: slang-compiler
source: learnings/1793669339765-slang-link-time-entry-point-checks-use-linkedir-en.md
---

# Slang link-time entry-point checks: use LinkedIR::entryPoints, not every IREntryPointDecoration func

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793657193763-f9uw61
written_at: 2026-11-03T01:28:59.765Z
---

# Slang link-time entry-point checks: use LinkedIR::entryPoints, not every IREntryPointDecoration func

When writing a post-link check over "the entry points of the output" in Slang (e.g. slang#14053 duplicate-name check), iterate `LinkedIR::entryPoints` (linkIR's return), NOT every global IRFunc carrying `IREntryPointDecoration`. A `[shader]` function from an imported module that the selected entry point only *calls* is cloned into the linked module WITH its decoration; `fixEntryPointCallsites` + DCE later turn it into an ordinary function. Scanning decorations gives false positives (repro: module with `A::K`/`B::K` `[shader]` funcs, `import` it, `-entry Main` calling both). The list can contain the same IRFunc twice (`-entry X -entry X`), so compare by identity. Also: HLSL/WGSL/LLVM to stdout link one entry point per output — tests need `-whole-program` (or `-o`) to put several entries in one linked module. And `checkEntryPointDecorations`'s `target` is the *intermediate* format (hlsl for dxil, glsl for -emit-spirv-via-glsl); use `CodeGenContext::getFinalTargetFormat()` for user-facing target names.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793669339765-slang-link-time-entry-point-checks-use-linkedir-en.md`_
