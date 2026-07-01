---
title: "Adding a SPIR-V capability atom to Slang (capdef recipe)"
type: learning
topic: slang-compiler
source: learnings/1781120340432-adding-a-spir-v-capability-atom-to-slang-capdef-re.md
---

# Adding a SPIR-V capability atom to Slang (capdef recipe)

# Adding a SPIR-V capability atom (e.g. spvShader64BitIndexingEXT, #11538 / PR #11541)

The literal "add a capability bit for SPV_<ext>" ask is an **atom-only** change in `source/slang/slang-capabilities.capdef` (the single source of truth). Two-layer pattern, mirroring `spvShaderNonUniformEXT : SPV_EXT_descriptor_indexing`:

```
/// Represents the SPIR-V extension for <desc>.
/// [EXT]
def SPV_EXT_<name> : _spirv_1_0;          // extension atom — append at end of the SPV_* extension block

/// Represents the SPIR-V capability for <desc>.
/// [EXT]
def spv<Cap>EXT : SPV_EXT_<name>;          // capability atom — append at end of the spv* capability block
```

Each `def` needs a `///` doc line + `/// [EXT]` group tag (capdef header rules).

**Verify before writing:**
- The `SpvCapability<...>` operand is usually already vendored — grep `external/spirv-headers/include/spirv/unified1/spirv.h`. If present, **no submodule bump**.
- Confirm the SPIR-V version floor from `spirv.core.grammar.json`: query the Capability enumerant. `"version": "None"` = extension-only ⇒ use `_spirv_1_0` (matches all sibling `SPV_EXT_*`).

**Non-obvious facts:**
- The build runs `slang-capability-generator` (`source/slang/CMakeLists.txt`) to turn capdef → generated C++ enum headers. **Never hand-edit generated headers.** A full configure+build is needed to pick up the new atom.
- Enum values for `CapabilityName`/`CapabilityAtom` are assigned by **declaration order** (`tools/slang-capability-generator/capability-generator-main.cpp`). Appending renumbers later atoms — but the enum is **generated/internal, not ABI-stable public surface** (`include/slang.h` only names it in a doc comment) ⇒ label **pr: non-breaking**. (Real labels: `pr: non-breaking` / `pr: breaking change` / `pr: new feature`.)
- The build **also regenerates `docs/user-guide/a3-02-reference-capability-atoms.md`** from your `///` comments. It's a TRACKED file — `git add` it alongside the capdef, or CI/regen shows a diff. (Atoms appear alphabetically in the doc, independent of capdef file position.)
- The atom is **inert alone** (emits nothing until referenced). Regression test: a `[require(spv<Cap>EXT)]` function wrapping inline `spirv_asm { OpExtension "SPV_EXT_<name>"; OpCapability <Cap>; ... }`, FileCheck `OpCapability` then `OpExtension` (that's the SPIR-V logical-layout order). The `[require(...)]` clause IS the guard — unknown-capability compile error before the atom exists. Templates: `tests/language-feature/spirv-asm/{opextension,opcapability}.slang`.
- `./extras/formatting.sh` does **not** touch `.capdef` or `.slang` (only `*.cpp/*.hpp/*.c/*.h`, CMake, YAML/JSON/MD, shell) — so missing clang-format/gersemi/shfmt in the container don't affect a capdef+test diff.
- **Gating pitfall:** a future consumer must NOT gate lowering on `targetCaps.implies(SPV_EXT_<name>)` (fresh extension atoms are added on-demand at emit, so the implies-check silently elides) — gate on target family `isSPIRV(...)`.
- **Scope:** the atom is only a *referenceable bit*. Functional language surface (auto-emit keyed off an IR op, or a new stdlib intrinsic) is net-new design with no in-tree surface to extend — flag it to the issue author as a separate follow-up rather than guessing the user-facing syntax.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781120340432-adding-a-spir-v-capability-atom-to-slang-capdef-re.md`_
