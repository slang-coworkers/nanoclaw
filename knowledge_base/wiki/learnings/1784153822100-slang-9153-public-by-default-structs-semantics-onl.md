---
title: "slang#9153 public-by-default structs — semantics-only at getDeclVisibility, mirror the interface rule"
type: learning
topic: slang-compiler
source: learnings/1784153822100-slang-9153-public-by-default-structs-semantics-onl.md
---

# slang#9153 public-by-default structs — semantics-only at getDeclVisibility, mirror the interface rule

**Task:** scope Feature #9153 — "public struct ⇒ members public by default", gated on language version ≥ 2026 (maintainer jkwak-work authorized Proposal 1). HEAD 8e3f9163d.

**Key finding (framing correction):** the request said "parser + decl-visibility resolution + LV gating", but it is **semantics-only** — no parser change. The parser already attaches `PublicModifier`/`InternalModifier`/`PrivateModifier` (all `VisibilityModifier`, slang-parser.cpp:10751) to any Decl, so `public struct Foo` already carries `PublicModifier` on the StructDecl. Per-member override also already works: the explicit-modifier loop in `getDeclVisibility` returns before any default logic.

**The single choke point:** `getDeclVisibility(Decl*)` at `source/slang/slang-check-decl.cpp:21251` is the ONE source of truth for effective decl visibility (consistent with prior learning "slang#10471 — single visibility choke point"). Its structure, in order: (1) explicit-modifier loop 21275-21283 (this IS per-member override); (2) **interface branch** 21284-21288 — `if (auto i = findParentInterfaceDecl(decl)) return getDeclVisibility(i);` — interface members inherit the interface's *effective* visibility; (3) module-default fallback 21289-21295 (`LEGACY?Public : parentModule->defaultVisibility` = Internal for 2025+).

**Principled fix = mirror the interface branch for public structs/classes.** Insert between (2) and (3): if `getModuleDecl(decl)->languageVersion >= SLANG_LANGUAGE_VERSION_2026` and `getParentAggTypeDecl(decl)` is effectively Public, return Public. Uses effective visibility recursively (composes transitively, matches interfaces), reuses the canonical mechanism, ~8 lines, no new helper.

**Gotcha:** `getDeclVisibility` is a FREE function (takes `Decl*`, no `SemanticsVisitor*`), so you CANNOT use the visitor-based `isSlang2026OrLater(this)` gate idiom (slang-check-decl.cpp:352) here — gate by reading `getModuleDecl(decl)->languageVersion` directly, exactly as line 21292 already does.

**Cascade watch-item:** member visibility drives synthesized `__init` parameter lists / "C-style struct" path — see comments in `tests/initializer-list/struct-visibility-1.slang` ("no public members → 0-arg ctor"). Any change to which members are public changes ctor synthesis → run the whole tests/initializer-list/ suite under both -std 2025 and -std 2026.

**Test templates:** `tests/language-feature/lang-version.slang` for the `-std 2026` vs default split; `struct-visibility-1.slang` for shape. LV constants: `SlangLanguageVersion` include/slang.h:5659 (LEGACY=2018/2025/2026/LATEST=2026). `getParentAggTypeDecl` (slang-syntax.cpp:1283) returns struct/class/interface but NOT ExtensionDecl (that's getParentAggTypeDeclBase) — correct scoping for this feature.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784153822100-slang-9153-public-by-default-structs-semantics-onl.md`_
