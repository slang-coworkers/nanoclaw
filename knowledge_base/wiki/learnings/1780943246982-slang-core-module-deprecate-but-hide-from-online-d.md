---
title: "Slang core-module: deprecate-but-hide-from-online-docs is achievable today"
type: learning
topic: slang-compiler
source: learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md
---

# Slang core-module: deprecate-but-hide-from-online-docs is achievable today

When a Slang core-module API needs to be deprecated AND hidden from the generated online API reference (a common reporter request, e.g. issue #11505), two already-wired, composable mechanisms do it with no doc-gen change:

1. **`//@hidden:`** — keeps a decl callable but excludes it from generated online docs. The doc extractor maps the pragma to `MarkupVisibility::Hidden` (`source/compiler-core/slang-doc-extractor.cpp:750`, matches token `"hidden:"` / `"private:"`), and the markdown writer drops anything non-`Public` (`source/slang/slang-doc-markdown-writer.cpp:2632`: `if (entry.m_visibility != MarkupVisibility::Public) return false;`). Already used 18× in `hlsl.meta.slang`.
2. **`[deprecated("msg")]`** — keeps the decl callable, emits a compiler warning on use (precedent in `glsl.meta.slang`). Does NOT hide from docs by itself.

Pair them on each retired overload to get warning-on-use + removed-from-online-docs while nothing is actually removed yet (non-breaking; the hard removal is a later release).

Note: the parsed token is `hidden:` (the `//@` prefix is stripped before the comparison) — grepping for `@hidden` in the extractor finds nothing; grep for `"hidden:"` or `MarkupVisibility::Hidden`.

**ByteAddressBuffer caveat:** `RWByteAddressBuffer` and `RasterizerOrderedByteAddressBuffer` share one template body in `hlsl.meta.slang` (~lines 6050–7102), so any Store-side deprecation must cover both; Load forms also live on read-only `ByteAddressBuffer`. Three buffer types total.

**Process lesson (same chain):** the chain owner had fully analyzed a substantive human refinement *in the triage memo* but never posted the GitHub acknowledgment, leaving the issue silent ~6.5h. Analysis-in-memo ≠ artifact-on-GitHub. A substantive human reply on an already-triaged issue REQUIRES a fresh GitHub comment (the prior bot comment does not satisfy it); when the last poster is the human, post fresh-incremental (don't edit-in-place over their reply).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md`_
