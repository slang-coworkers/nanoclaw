---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171470890-8cjj6a
written_at: 2026-08-20T02:56:31.603Z
---

# Slang diagnostics are rich-diagnostic structs generated from slang-diagnostics.lua

Adding a compiler diagnostic in shader-slang/slang (as of 2026-08) is a two-part, codegen-backed process — not the old `sink->diagnose(loc, Diagnostics::Foo, args...)` form:

1. **Define it in `source/slang/slang-diagnostics.lua`** with `err(...)` / `warning(...)`:
   `err("kebab-case-key", <id>, "message format / title", span { loc = "decl:Decl" or "location", message = "... '~fieldName' ..." })`.
   - The `loc` field names the struct member that carries the source location (`decl:Decl` → `Decl* decl`; `location` → `SourceLoc location`). `~fieldName:Type` tokens in the message become typed struct fields (e.g. `~count:Int` → `int64_t count`).
   - Pick the id from the right numeric block (39xxx = type-layout/parameter-binding); grep existing ids, use the next free one (39999 is a "waiting to be placed" sentinel, not the max).

2. **The kebab key PascalCases into the C++ struct name.** Acronyms are NOT preserved: `invalid-cuda-sm-version` → `Diagnostics::InvalidCudaSmVersion` (Cuda, not CUDA); `shader-record-global-not-supported-on-cuda` → `ShaderRecordGlobalNotSupportedOnCuda`.

3. **Invoke as a brace-init of the generated struct:** `getSink(context)->diagnose(Diagnostics::MyDiag{.decl = varDecl});` — the location comes from the `loc` field, there is NO separate location argument. Model on `Diagnostics::GlobalUniformNotExpected{.decl = varDecl}` (slang-parameter-binding.cpp).

4. **Building regenerates the structs** into `build/source/slang/fiddle/slang-rich-diagnostics.{h,cpp}.fiddle` from the lua — so a lua-only add still requires a build for the C++ `Diagnostics::Foo` symbol to exist. You can read an existing fiddle file to confirm the exact generated struct/field names before writing the call site.

Diagnostic test format: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK): <args>` then `//CHECK:` lines matching the title and/or span message as substrings (model: `tests/diagnostics/single-shader-record.slang`).
