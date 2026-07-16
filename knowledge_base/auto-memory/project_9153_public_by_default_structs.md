---
name: project_9153_public_by_default_structs
description: "#9153 public-by-default struct members — maintainer-authorized impl, Proposal 1, LV-2026 gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: f00cad78-6d98-4ab9-9c85-a792a90c2555
---

shader-slang/slang **#9153** — "Syntactic sugar for public-by-default structs". jkwak-work (COLLABORATOR) authorized impl 2026-07-15 (comment 4985648666): "aligned to go with proposed solution 1 ... make a PR." Design settled, `Dev Reviewed`, Q1-2026 milestone.

**Proposal 1:** `public struct` ⇒ unmodified members default to `public`; per-member `private`/`internal` still override. **Hard gate (bmillsNV):** LV ≥ 2026 only; pre-2026 unchanged (breaking visibility change).

**Triager finding (VERIFY before relaying as fact):** semantics-only, NOT parser — parser already attaches `PublicModifier` to `public struct` and per-member override already works. Recommended approach A: mirror interface-inherits-visibility branch at choke point `getDeclVisibility` (slang-check-decl.cpp:21251), gate on `getModuleDecl(decl)->languageVersion >= SLANG_LANGUAGE_VERSION_2026`. ~8 lines. Watch: ctor-synthesis cascade (tests/initializer-list). HEAD 8e3f9163d.

**Chain:** orch → slang-triager (owns fixer wire) → slang-fixer. Triage comment posted id 4985783248 ("fix incoming as draft PR held pending review"). Draft PR held pending review per standing policy. Thread `gh-issue-shader-slang/slang-9153`. Awaiting [Fix Report] up-chain.

**Briefing memo:** triager's full memo (A/B/C solution space, file:line @ HEAD 8e3f9163d, cascade watch-items, 4 tests) at inbox path `/workspace/inbox/a2a-1784153638851-ngpuhg/triage-9153.md` (msg #6).
