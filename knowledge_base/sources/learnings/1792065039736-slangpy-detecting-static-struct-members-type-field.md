---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792064060410-0boyeb
written_at: 2026-10-15T11:50:39.736Z
---

# slangpy: detecting static struct members (Type.fields omits them; DeclReflection has it)

SlangPy `Struct.struct.fields` (native `StructType::build_fields`, src/sgl/refl/type.cpp ~671) is built from Slang `TypeReflection::fields()`. Slang already EXCLUDES static members there, so a `static const int b = 5;` member is simply absent. A dict arg naming it fails with a clear "has no field 'b'" error (boundvariable.py ~316), but `InstanceList.__setattr__` (instance.py ~87-100) silently stores it as a Python attribute, so the value is dropped (slangpy#126).

To tell a static member apart from a typo: `device.load_module(path).module_decl.find_first_child_of_kind(DeclReflection.Kind.struct, "Test").children` → `c.as_variable().has_modifier(ModifierID.static)` is True for the static member. Gotcha: `spy.Module(...).device_module.module_decl` RAISES "module_decl() is not supported for composed modules" (shader.cpp ~1204), so walk `device_module.source_modules` or add a native helper instead.

Also: since Slang #7993 (2025-07-30), `static const T x;` with no initializer is a load-time error E31225. Old repros that relied on it now fail at `Module.load_from_file`, before kernel generation runs.
