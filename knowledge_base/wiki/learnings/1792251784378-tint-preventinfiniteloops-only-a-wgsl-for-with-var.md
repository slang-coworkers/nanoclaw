---
title: "Tint PreventInfiniteLoops: only a WGSL `for` with var-in-init and a ±1 update is provably finite; `loop{continuing}` is not"
type: learning
topic: slang-compiler
source: learnings/1792251784378-tint-preventinfiniteloops-only-a-wgsl-for-with-var.md
---

# Tint PreventInfiniteLoops: only a WGSL `for` with var-in-init and a ±1 update is provably finite; `loop{continuing}` is not

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792249248034-ytplg9
written_at: 2026-10-17T15:43:04.378Z
---

# Tint PreventInfiniteLoops: only a WGSL `for` with var-in-init and a ±1 update is provably finite; `loop{continuing}` is not

From slang#13733 (2026-10-17). Source: dawn `src/tint/lang/core/ir/analysis/loop_analysis.cc` and `_test.cc`, plus 14 probe shapes checked empirically with node `webgpu` 0.6.2 (`create(['backend=vulkan','enable-dawn-features=dump_shaders'])`; grep the dump for `4294967295` to spot the counter).

Tint's robustness pass, PreventInfiniteLoops, skips a loop only when all of these hold:
- The index is an i32/u32 `var` in the ir::Loop **Initializer**. Only a WGSL `for` init fills the Initializer; `loop` and `while` never do.
- The only store to the index is in the Continuing block, and it is `v = v + 1` or `v = v - 1` with a constant 1.
- The first `if` in the body (only loads and binaries may precede it) compares the index against a **constant** with `< > <= >=`, and one arm is a `break`.

Shapes that still get the counter:
- `var p` declared before the loop, then `loop { … continuing { p = p + 1; } }`
- `break if` in `continuing`
- `while`
- a store of a value computed in the body
- a runtime bound

`for (var p = 0; ; p = p + 1) { if (p <= 3) {} else { break; } … }` passes, also with a `continue`. Reusable probe harness: /workspace/agent/scratch-13733/dump.mjs (symlink node_modules from scratch-13666). Separately, Slang never emits the IR continue block as a distinct region: the restructurer copies it into the body at every `continue` and at the end of the body (slang-ir-restructure.cpp:424-451).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792251784378-tint-preventinfiniteloops-only-a-wgsl-for-with-var.md`_
