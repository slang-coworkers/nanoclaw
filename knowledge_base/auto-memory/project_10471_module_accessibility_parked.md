---
name: project_10471_module_accessibility_parked
description: "#10471 module import/accessibility feature — 2-part, maintainer-owned, PARKED at triaged"
metadata: 
  node_type: memory
  type: project
  originSessionId: a41f9955-1028-4392-a3ee-c72f870d4df5
---

shader-slang/slang **#10471** — "Improve module import / accessibility controls" (author ccummingsNV, SlangPy/Falcor lead). Two-part FEATURE request, `Dev Reviewed` + `RTR`, assigned **jkwak-work**. Triaged @ HEAD bfe6a7f14, severity low/enhancement, component frontend (module system + visibility).

**Two asks + maintainer-blessed scope-reductions (csyonghe, issuecomment-4069451326, 2026-03-16 — AUTHORITATIVE):**
- **Part 1:** reporter wanted bidirectional `implementing`-style injection (generated kernel "part of" target module w/o `__include`). Maintainer reduced to a **slangpy-only `__slangpy_trampoline import M;` modifier** → makes M's `internal` symbols visible to the tagged importing scope only. Code sites: new modifier like `__exported` (ast-modifier.h ~142, parser ~11009); tag scope in `importModuleIntoScope` (slang-check-decl.cpp:16805-16849); **single visibility choke point** `isDeclVisibleFromScope` slang-check-expr.cpp:1092-1120 (Internal gate :1097-1103). Semantic-check-only — internal symbols survive IR lowering + serialization (DeepWiki confirmed).
- **Part 2:** reporter wanted C++-style `public:` access-sections. Maintainer reduced to **`public struct` members default to public**. Code site: `getDeclVisibility` fall-through slang-check-decl.cpp:20954-20960 — key default off immediate `AggTypeDeclBase` parent visibility (NOT module default). Compatible w/ E30601 (equal visibility allowed). Needs visibility tests updated (tests/initializer-list/struct-visibility-1.slang etc.) + cross-module positive tests.

**Disposition:** PARKED at triaged. Both parts engineering-confirmed design-ready, but maintainer-owned (existing core-architect design, assigned maintainer, no bot-directed ask) — precedent [[project_11746_witnesstable_refactor_pending]], [[project_11989_examples_fail_on_warnings]]. **NO auto-dispatch fixer.** Verdict posted to GitHub (comment 4916184926, verified, endorses csyonghe — non-preempting). Endorse maintainer design as-is; do NOT propose Part-1-B (`implementing`) or Part-2-B (`public:` sections) — both set aside by maintainer.

**RE-OPENED (discussion, not release) 2026-07-08:** jkwak-work commented (issuecomment-4919708540) that @skiminki-nv has a **concern about Part 2**, linking [#9153 issuecomment-3659431983](https://github.com/shader-slang/slang/issues/9153#issuecomment-3659431983). Per [[feedback_reopen_not_release_parked_feature]] this reopens the *Part-2 design discussion*, NOT auto-release — no fixer dispatch. Routed slang-triager to read skiminki's concern + assess whether it invalidates/qualifies the blessed "`public struct` members default public" direction, and report upstream. Part 1 untouched (concern is Part-2-only). Implementation + any GitHub reply stay maintainer-go-gated. Awaiting triager assessment.
