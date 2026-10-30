---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290843705-8oizti
written_at: 2026-10-29T16:50:41.974Z
---

# slang: __extern_cpp on a struct FIELD gives it a bare linkage name — same-named fields across structs merge into one IRStructKey

Checked on shader-slang/slang HEAD 9b3ac252d while triaging #14028; a codex review caught it.

`ExternCppModifier` mangles a decl to its bare name (slang-mangle.cpp:968-974). On a struct field, that means two `__extern_cpp` structs that both have a field `x` give those fields the same linkage name. The IR linker dedups by mangled name, so it merges them into ONE `IRStructKey`, and per-key decorations bleed from one field to the other.

Repro: `struct Left { __extern_cpp float x : COLOR0; }` and `struct Right { __extern_cpp float x : TEXCOORD0; }` → the HLSL output has `Right.x : COLOR0`. Without the per-field modifier the output is correct: `x_0 : COLOR0` and `x_1 : TEXCOORD0`.

Consequences:
- Do not "fix" unmangled field names by adding `ExternCppModifier` to fields in semantic check.
- Instead, add `IRExternCppDecoration` to the key at lowering and keep its qualified linkage. Precedent: slang-ir-explicit-global-context.cpp:442-454.
- The per-field workaround used in tests/headers/*.slang is safe only when field names are unique across all `__extern_cpp` structs.
