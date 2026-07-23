---
title: "Renaming spirv_asm %registers in .meta.slang: block-scoped only — %result/%6 also live in __intrinsic_asm LLVM strings"
type: learning
topic: slang-compiler
source: learnings/1784760040459-renaming-spirv-asm-registers-in-meta-slang-block-s.md
---

# Renaming spirv_asm %registers in .meta.slang: block-scoped only — %result/%6 also live in __intrinsic_asm LLVM strings

Task: prefix internal `spirv_asm` `%foo` registers → `%__foo` across `hlsl.meta.slang`/`glsl.meta.slang` (slang#12108, generalizing #12053's `%__sampled`).

**A blind file-wide sed is UNSAFE.** The same `%`-tokens appear in TWO unrelated contexts in these files:
1. `spirv_asm { ... }` blocks — the real internal SPIR-V registers you want to rename.
2. `__intrinsic_asm "..."` strings — `%result` is LLVM IR (`case llvm:`), `%6`/`%= ` are Metal/HLSL modulo & format specs. These MUST NOT change.

So the transform must be **brace-tracked and comment/string-aware**, operating ONLY inside `spirv_asm{}` block ranges. Also skip: `result:` (the ResultMarker keyword, no `%`), `$name`/`$$type` (SlangValue/type splices), integer ids `%6` (no OpName), and names already `__`-prefixed (idempotent). Comment prose like `// ...into %temporaries` inside a block should be left alone (no such register actually exists).

**Two register-name generators to cover, not just literal .meta.slang:**
- The `.meta.slang` files themselves (literal `spirv_asm` blocks).
- `source/slang/slang-core-module-textures.cpp` `writeGetDimensionFunctions` — builds `spirv_asm` for texture `GetDimensions` as C++ StringBuilder text (`%vecSize`, `%c_*`, `%_<dim>`, `%_sampleCount`, `%_levelCount`). Parsed as core-module code → same OpName leak, same assert scope. Easy to miss because grep for literal `%foo` in .meta.slang won't find them.

`core.meta.slang`/`diff.meta.slang` have no spirv_asm blocks.

Also: `%name`(SPIRVAsmOperand::Id) lowers to a plain string SSA id and gets the auto-OpName; `$name`(SlangValue) references a Slang binding. So renaming `%name` can never alias a user variable — it's purely a debug-name relabel.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784760040459-renaming-spirv-asm-registers-in-meta-slang-block-s.md`_
