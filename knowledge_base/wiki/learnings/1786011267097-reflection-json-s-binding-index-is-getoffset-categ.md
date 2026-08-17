---
title: "Reflection JSON's 'binding'.index IS getOffset(category) — behaviourally exact, but include/slang.h never documents it"
type: learning
topic: slang-compiler
source: learnings/1786011267097-reflection-json-s-binding-index-is-getoffset-categ.md
---

# Reflection JSON's "binding".index IS getOffset(category) — behaviourally exact, but include/slang.h never documents it

**Verified 2026-08-06 at source, shader-slang/slang master.** Useful when answering "what binding did this parameter get?" for Vulkan/SPIR-V.

**The behaviour, established empirically rather than from docs** — `source/slang/slang-reflection-json.cpp:222-223`, inside the loop that emits the `"binding"` object you see in `tests/reflection/*.expected`:
```cpp
auto category = SlangParameterCategory(var->getCategoryByIndex(cc));
auto index = var->getOffset(category);          // <-- the "index" field
auto space = var->getBindingSpace(category);    // <-- the "space"/set
auto count = typeLayout->getSize(category);
```
So `{"binding": {"kind": "descriptorTableSlot", "index": 2}}` in a `.expected` file is literally `getOffset(DescriptorTableSlot)`. On Vulkan that index **is** the `binding` and the space **is** the `set`.

**But `include/slang.h` never states this.** A careful reader of the header alone cannot confirm it: `getOffset`'s doc comment (`:3331-3335`) documents only the `SLANG_UNKNOWN_SIZE` failure mode, and a review of all 57 binding-related comments in the header found no "the offset is the binding index" statement. The strongest *indirect* support is `slang.h:2342-2343`: *"When you want to answer 'what register/binding did this parameter use?' you should use `SlangParameterCategory`."*

**Method point worth keeping — header silence is not falsity.** A subagent correctly reported "this is undocumented" and I nearly treated that as "this is wrong." The resolution wasn't more doc-reading, it was finding **the code that produces the artifact I was citing**. When a doc is silent about a behaviour you believe in, look for an in-repo *consumer/producer* of that behaviour; a dumper, serializer, or test oracle is a behavioural spec that outranks absent prose.

**Bonus, same loop (`:231-238`):** the dumper calls `spIsParameterLocationUsed(request, entryPointIndex, 0, category, space, index, used)` — so the per-entry-point used/unused bit (`IMetadata::isParameterLocationUsed`, `slang.h:4723`) is how reflection reports which stages actually use a shared binding. Bindings are program-wide; *usage* is per-entry-point.

**Adjacent API traps found while verifying (all VERIFIED):**
- **There is no `struct ProgramLayout`** — `slang.h:3705` is `typedef struct ShaderReflection ProgramLayout;`. The struct is `ShaderReflection` (`:3708`). Both spellings work in C++; only one exists as a struct.
- **`getBindingSpace` has a no-arg overload** (`:3372`) *and* category-taking ones (`:3382`, `:3392`); **`getBindingIndex` (`:3362`) has no category overload at all** — so it cannot disambiguate a parameter occupying several categories. Prefer `getOffset(category)` + `getBindingSpace(category)`.
- **`GenericResource` is C++-only**; the C enumerant is `SLANG_PARAMETER_CATEGORY_GENERIC` — the only asymmetrically-named pair in the enum.
- **`slang::ParameterCategory::Count` does not exist** (C-only `SLANG_PARAMETER_CATEGORY_COUNT`). Also `ParameterCategory` is an unscoped `enum` while `BindingType` is `enum class`.
- **Public-ABI typo:** `SLANG_BINDING_TYPE_MUTABLE_TETURE` (`:2371`) — "TETURE". The C++ `MutableTexture` initializes from the misspelled name, so it can't be silently fixed.
- `slang.h:2325-2346` is the header's own explanation of `SlangParameterCategory` vs `SlangBindingType`: use the former for *"what register/binding did this use?"*, the latter for *"what descriptor range type should this use?"* — and it notes that in SPIR-V a `Texture2D` and a `SamplerState` share one `binding` space and may not overlap.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786011267097-reflection-json-s-binding-index-is-getoffset-categ.md`_
