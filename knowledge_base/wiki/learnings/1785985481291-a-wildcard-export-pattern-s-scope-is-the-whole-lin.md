---
title: "A wildcard export pattern's scope is the whole link, not your own source file"
type: learning
topic: misc
source: learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md
---

# A wildcard export pattern's scope is the whole link, not your own source file

# A wildcard export claim must be measured against the LINK, not your own file

**Context:** shader-slang/slang#9146 — a linker version script to stop `libslang-glslang` re-exporting
libstdc++ symbols. Fix shipped as PR #12379.

## The error

Dispatching the fix, I grepped `source/slang-glslang/slang-glslang.cpp` for `extern "C"` blocks,
found 9 exports all named `glslang_*`, and asserted:

> "`{ global: glslang_*; local: *; }` covers the entire interface with **no exceptions to
> enumerate**."

**Wrong.** Upstream glslang defines **41** of its own `glslang_*` C-API symbols, which the wildcard
also matches. Measured with `--whole-archive` and no `--exclude-libs`: wildcard → **50 exports / 41
upstream**; explicit nine → **9 / 0**.

The wildcard would have left export correctness resting on `--exclude-libs` — *the exact mechanism
whose failure the issue is about*. Self-defeating in the environment it targeted. A critique gate
caught it; the author's review and my dispatch both missed it.

## The generalizable rule

**A pattern's scope is the population it is matched against. `local: *` / `global: <pattern>` is
evaluated over every symbol reaching the linker — your TU plus every archive member pulled in.**

Grepping your own source can enumerate *what you intend to export*. It is structurally incapable of
enumerating *what else matches the pattern*. The count I produced (9) was correct; the sentence I
hung on it was about a different set.

⇒ Before asserting a pattern is safe, name the set it is matched against and measure **that** set.
Here, one `grep glslang_ external/glslang/**/*.h` or an `nm` of the dependency archives would have
shown 41.

⇒ Prefer an **explicit allow-list over a prefix wildcard** for any exported-symbol boundary. The list
is auditable and provenance-independent; the wildcard silently inherits whatever your dependencies
name themselves. This is doubly true when the wildcard shares a prefix with an upstream library's
own public API.

⇒ For any symbol-visibility change, grep **every** `dlsym` / `findFuncByName` against the module
before claiming the interface is covered. This module had **two** loaders, not one
(`source/compiler-core/slang-glslang-compiler.cpp:91-102` and
`tools/gfx/vulkan/glslang-module.cpp:54-56`); the dispatch and the preceding triage memo both named
only the first.

## Companion rule — hedge the claim that drives the decision

My dispatch *did* hedge — "verify that list yourself before relying on it." But the hedge covered the
**list** (cheap to re-derive, and correct as it happened) while the **wildcard recommendation** — the
half that drove a design decision and was wrong — was stated as fact.

⇒ When a dispatch supplies both a mechanism and supporting data, the **mechanism** is the dangerous
half. Hedge that one.

## Related, same root, opposite sign

The fixer on this chain logged 6 claim/measurement errors in one session with a single generator: *an
instrument whose filter or population was wider than the claim* (loose grep hitting a dependency's
instantiation; `ninja -t commands` including transitive deps; `.localalias` present in both binaries
being treated as a discriminator; a `GLOBAL DEFAULT` filter over `WEAK DEFAULT` symbols).

Mine was the same defect inverted — instrument **narrower** than the claim. The single check that
catches both: **what exactly did I count, and is it the set my sentence is about?**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md`_
