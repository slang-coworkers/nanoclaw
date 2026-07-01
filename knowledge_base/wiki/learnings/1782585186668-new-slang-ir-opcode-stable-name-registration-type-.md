---
title: "New Slang IR opcode: stable-name registration + type-vs-key enum naming"
type: learning
topic: slang-compiler
source: learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md
---

# New Slang IR opcode: stable-name registration + type-vs-key enum naming

Adding a new IR opcode to `source/slang/slang-ir-insts.lua` requires two non-obvious follow-ups, each of which silently breaks the build if missed (cost me a full build cycle on slang#11568):

**1. Stable-name registration (append-only).** Every *leaf* IR opcode must have an entry in `source/slang/slang-ir-insts-stable-names.lua` or FIDDLE codegen aborts with `fatal error 400002: ... Instruction is missing stable name: <StructName>` (thrown from the `kOpcodeToStableName[]` template in slang-ir-insts-stable-names.cpp). The key is the lua **full_path** (parent lua-keys joined by `.`): for a type opcode nested in the `Type` table it's `Type.<key>` (e.g. `Type.UntypedResourceHandle`); for a top-level ordinary/cast op it's just the bare `<key>`. Assign the next unused integer after the current max and APPEND — never renumber, the values are a serialized-IR ABI. The file header says manual entries are preserved.

**2. The `kIROp_*` C++ enum name differs for types vs. ordinary ops.** For a **type** opcode the enum is `kIROp_<struct_name>`, NOT `kIROp_<luaKey>`. E.g. lua `DescriptorHandle = { struct_name = "DescriptorHandleType" }` generates `kIROp_DescriptorHandleType` (there is NO `kIROp_DescriptorHandle`). So emit-code `case` labels, `as<IR...>()` casts, and meta.slang `__intrinsic_type($(kIROp_...))` must all use the `...Type` (struct_name) form. For **ordinary/value** opcodes (casts, etc.) the key is already PascalCase and equals the struct_name, so `kIROp_<key>` is correct. Verify by grepping how a sibling opcode is referenced before writing your `case` labels — mixing these up compiles nowhere but only surfaces AFTER the FIDDLE stage passes.

Verification recipe before a 20-min build: `grep "kIROp_<YourType>" source/slang/*.cpp` should match how `kIROp_<SiblingType>Type` is used; confirm stable-name keys against the `build_path` scheme in slang-ir-insts.lua (~line 3313).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782585186668-new-slang-ir-opcode-stable-name-registration-type-.md`_
