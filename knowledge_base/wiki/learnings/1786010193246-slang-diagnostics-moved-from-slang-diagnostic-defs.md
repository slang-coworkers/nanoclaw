---
title: "Slang diagnostics moved from slang-diagnostic-defs.h to slang-diagnostics.lua"
type: learning
topic: slang-compiler
source: learnings/1786010193246-slang-diagnostics-moved-from-slang-diagnostic-defs.md
---

# Slang diagnostics moved from slang-diagnostic-defs.h to slang-diagnostics.lua

# Slang diagnostics are Lua-defined now, not `DIAGNOSTIC(...)` macros

## The premise trap
`source/slang/slang-diagnostic-defs.h` **no longer exists** (404 on master, 2026-08-06). Any task/doc/memory telling you to grep it for `DIAGNOSTIC(id, Severity, name, msg)` is stale. Authoritative definition site is now:

- `source/slang/slang-diagnostics.lua` (~6171 lines) — the definitions
- `source/slang/slang-diagnostics-helpers.lua` — `err()`/`warning()`/`fatal()`/`internal()`/`standalone_note()` helpers
- `source/slang/slang-rich-diagnostics.h.lua` — severity → C++ enum map
- FIDDLE templates in `slang-rich-diagnostics.{h,cpp}` generate the C++ structs

Confirmed by `slang-diagnostics.h`: *"All diagnostics are now defined in slang-diagnostics.lua and generated via slang-rich-diagnostics.h. The old slang-diagnostic-defs.h has been removed."*

## New definition form
```lua
warning(
    "parameter-bindings-overlap",   -- kebab-case name
    39001,                          -- code (E39001)
    "explicit binding overlap",     -- short title
    span { loc = "paramA:Decl", message = "..." },
    note { message = "...", span { loc = "paramB:Decl" } }
)
```
Severity is the **helper you call**, not a field: `err()` → `Severity::Error`, `warning()` → `Severity::Warning` (mapping in `slang-rich-diagnostics.h.lua` `severity_map`). Names are kebab-case in Lua, lowerCamel in C++ (`parameter-bindings-overlap` → `parameterBindingsOverlap`).

Only three C++ catalogs remain, all under `source/compiler-core/`: `slang-misc-`, `slang-lexer-`, `slang-json-diagnostic-defs.h`. A cross-catalog collision check in the helpers file enforces one name per integer code.

## Reading it
The MCP `github_get_file_contents` output exceeds the token cap; it persists to a local JSON file. `python3 -c "json.load(...)['content']"` into /tmp, then grep. Grepping the persisted JSON directly works too but line numbers are useless (whole file is one JSON line).

## Diagnostic aliases exist — grep can lie
`source/slang/slang-diagnostics.cpp` has `lookup->addAlias("overlappingBindings", "parameterBindingsOverlap")`. So `[allow("overlapping-bindings")]` in a test resolves to E39001 even though that exact string appears **nowhere** in the definitions. If a test suppresses a diagnostic by a name you can't find, check `addAlias` before concluding a second diagnostic exists.

## Enumerate ALL callers before claiming a target gate
A subagent read `addExplicitParameterBinding` (`slang-parameter-binding.cpp:877`), found the caller `addExplicitParameterBindings_HLSL` (guarded `if (!isD3DTarget && !isMetal) return;`) and concluded E39001 is "D3D/Metal only, not Vulkan". **False.** `grep -n addExplicitParameterBinding` shows *six* call sites (1032, 1081, 1297, 1402, 1509, 1549). Line 1297 is inside `addExplicitParameterBindings_GLSL`, gated on `isKhronosTarget` — the Vulkan path — and 1509/1549 are the `[[vk::binding]]` entry-point path. Three checked-in tests expect `warning[E39001]` under `-target spirv`.

Lesson: finding *one* guarded caller answers "is it reachable from D3D?", not "is it D3D-only". The control that settles it costs one grep for the callee name, and checked-in `tests/diagnostics/*.slang` FileCheck lines (`// CHECK: warning[E39001]`) are ground truth for severity — cheaper and more decisive than reading emission-site control flow.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786010193246-slang-diagnostics-moved-from-slang-diagnostic-defs.md`_
