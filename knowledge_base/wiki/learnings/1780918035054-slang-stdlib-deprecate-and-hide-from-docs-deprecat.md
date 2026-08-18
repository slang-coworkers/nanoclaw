---
title: "Slang stdlib: deprecate-and-hide-from-docs = [deprecated()] + //@hidden: (two separate mechanisms)"
type: learning
topic: slang-compiler
source: learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md
---

# Slang stdlib: deprecate-and-hide-from-docs = [deprecated()] + //@hidden: (two separate mechanisms)

To keep a Slang core-module (`*.meta.slang`) function CALLABLE but remove it from the generated online API docs (e.g. when deprecating an overload), you need TWO independent, composable markers — there is no single attribute that does both today:

1. **`[deprecated("message")]`** — keeps it callable, emits a compiler warning on use. Does NOT affect doc visibility. Attribute class `source/slang/slang-ast-modifier.h:2016`; syntax declared at `source/slang/core.meta.slang:4718` (`attribute_syntax [deprecated(message: String)] : DeprecatedAttribute;`). Real precedent: `source/slang/glsl.meta.slang:10355+`.
2. **`//@hidden:`** (line comment pragma above the decl) — excludes it from generated docs, stays callable. `MarkupVisibility` enum (Public/Internal/Hidden) at `source/compiler-core/slang-doc-extractor.h:12`; parser recognizes `//@hidden:` and `//@private:` at `source/compiler-core/slang-doc-extractor.cpp:750`; doc generator drops any non-`Public` entry at `source/slang/slang-doc-markdown-writer.cpp:2632` (`if (entry.m_visibility != MarkupVisibility::Public) return false;`). Already used ~20× in `hlsl.meta.slang` (e.g. lines 2, 73, 579).

Gotcha: the `///`-style doc-comment tags `@deprecated` and `@internal` (parsed in slang-doc-markdown-writer.cpp ~1477–1485) only render callout BOXES in the docs — they do NOT hide the entry. Don't confuse them with `//@hidden:`.

**Why:** A maintainer/author may accept a deprecation only if the deprecated surface can also be hidden from public docs (this was the acceptance condition on issue #11505). The answer is "yes, today, no doc-gen change" — but only if you pair both markers. **How to apply:** any task that deprecates stdlib intrinsics and wants them gone from the API reference; also note RWByteAddressBuffer + RasterizerOrderedByteAddressBuffer share one template in hlsl.meta.slang (~6050–7102), so tag both, plus the read-only ByteAddressBuffer copy.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md`_
