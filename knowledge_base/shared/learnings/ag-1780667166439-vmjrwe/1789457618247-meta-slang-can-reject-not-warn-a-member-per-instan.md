---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789457074643-irsqov
written_at: 2026-09-15T07:33:38.247Z
---

# meta.slang can reject (not warn) a member per-instantiation via static_assert on a generic let / T.kind

When you need a core-module member (e.g. an `__implicit_conversion __init`) to be a compile ERROR for a subset of a generic parameter's values, `static_assert` in the member body is the mechanism — and its severity limits what's expressible.

- **`static_assert(constexpr bool, NativeString msg)`** is defined once (`core.meta.slang:483`) and is the ONLY compile-time diagnostic primitive in the meta language. It is **error-only** — there is no `static_warn`/`static_warning`/`__diagnostic` (grep confirms none in `source/slang`). Consequence: a **reject** diagnostic keyed on a generic parameter lives cleanly in meta.slang; a **warning** keyed on a generic parameter CANNOT — it forces a checker-side path (a `slang-diagnostics.lua` entry + a hook at the conversion site).
- `static_assert` in a **generic member body** fires **per-instantiation** (only when the offending specialization is actually used), so it produces a targeted error at the user's call site while leaving other specializations untouched. Pervasive precedent in `_Texture` method bodies keyed on generic `let` ints/`Shape`: `hlsl.meta.slang:1791, 1894, 1937`, and the `isShadow`/`isArray`/`isMS`/`access` family at `:1135-1161`.
- If the discriminating flag is NOT an in-scope `let` but rides on a generic type `T` bound by an interface, use the interface's **`static const`**: e.g. `_Texture`'s `static const DescriptorKind kind` (from `isCombined`) is readable through a generic `DescriptorHandle<T>` as `T.kind`. The core module already branches on `T.kind == DescriptorKind.CombinedTextureSampler` at compile time (`hlsl.meta.slang:27782`, `switch(T.kind)` at `:28023`, `:28081`), so `static_assert(T.kind != DescriptorKind.CombinedTextureSampler, "...")` is expressible. (One caveat: `static_assert` on an associated `static const` is high-but-unproven-by-compile confidence; the `if (T.kind==...)`-guarded form is the proven fallback and stays in meta.slang.)
- Prefer `static_assert` over *omitting* the member: omission gives a generic "cannot convert X to Y"; `static_assert` lets you author the exact guidance message.

Context: shader-slang/slang#13085 (ResourceDescriptorHeap single-index → combined texture/sampler silently defaults sampler slot 0). The two zero-fill `__init`s are `_Texture.__init(UntypedResourceHandle)` :27622-27625 (`isCombined` in scope) and `DescriptorHandle<T>.__init(UntypedResourceHandle)` :27905-27910 (`T.kind`).
