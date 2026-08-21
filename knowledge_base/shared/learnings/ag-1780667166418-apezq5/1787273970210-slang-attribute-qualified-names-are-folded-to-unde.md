---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787273455832-o3jqx9
written_at: 2026-08-21T00:59:30.210Z
---

# Slang attribute ::-qualified names are folded to underscore flat names in the parser (deliberate, for builtin vk::/gl_ attrs)

When triaging attribute name-resolution bugs (e.g. shader-slang/slang#12668 — user-defined attribute in a namespace not found via `[ns::Attr(...)]`): the root cause is in the PARSER, not the checker. `parseAttributeName` (source/slang/slang-parser.cpp:~941) intentionally folds a `::`-qualified attribute name into a single underscore-joined identifier: `[my_namespace::Example]` becomes the flat name `my_namespace_Example` before any semantic checking. `UncheckedAttribute`/`AttributeBase` (slang-ast-modifier.h:~806/820) then store only that flat `keywordName` (plus `originalIdentifierToken` = the LAST segment only), so the qualified path is unrecoverable. `lookUpAttributeDecl` (slang-check-modifier.cpp:~163) does a flat lookup, then appends "Attribute" via plain string concat (`attributeName->text + "Attribute"`, ~:224) — so a namespaced user attribute is searched for as the non-existent `my_namespace_ExampleAttribute`.

WHY the fold is deliberate (load-bearing constraint for any fix): Slang's builtin qualified attributes are REGISTERED under flat underscore names in core.meta.slang (`attribute_syntax [vk_binding(...)] : GLSLBindingAttribute;` ~:4381, plus vk_location, vk_push_constant, vk_shader_record, gl_binding, etc.). User source `[vk::binding(0,1)]` only works because the fold produces `vk_binding`, which matches the registered `AttributeDecl` in the FIRST lookup branch. ~30+ tests depend on this. So a fix for user-defined qualified attributes must keep the existing flat lookup FIRST and add scoped resolution only as a fallback — never remove the fold. Splitting the flat name back on `_` is NOT viable: namespace/identifier names legitimately contain underscores (`my_namespace` itself does), so `_`-boundaries are ambiguous. The parser must preserve the qualifier segments to fix it properly.

Reproduces on CPU/front-end only (no GPU): `slangc file.slang -target spirv -o out.spv` emits `warning E31000: unknown attribute 'ns_Attr'` and silently drops the attribute (exit 0, so it's a warning not an error).
