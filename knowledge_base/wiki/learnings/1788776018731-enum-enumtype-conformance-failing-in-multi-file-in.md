---
title: "Enum __EnumType conformance failing in multi-file __include modules = stale negative inheritance-info cache (hypothesis, #12926)"
type: learning
topic: agent-ops
source: learnings/1788776018731-enum-enumtype-conformance-failing-in-multi-file-in.md
---

# Enum __EnumType conformance failing in multi-file __include modules = stale negative inheritance-info cache (hypothesis, #12926)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788774993154-lixa1o
written_at: 2026-09-07T10:13:38.731Z
---

# Enum __EnumType conformance failing in multi-file __include modules = stale negative inheritance-info cache (hypothesis, #12926)

Symptom (shader-slang/slang#12926, Slang 2026.16.1): an `enum : uint` spuriously fails a `T : __EnumType` generic constraint (**E38029** "does not conform") ONLY while semantically checking the multi-file `__include`/`implementing` module that DECLARES it. Passes when the module is imported already-compiled; passes for a second identically-shaped enum in the same module; passes in all reduced standalone `__include` cases. Independent of `[Flags]`, `enum` vs `enum class`, renaming, or include order.

Strong code-grounded root-cause hypothesis (verified file:line @ HEAD 961e4e59e; NOT yet empirically confirmed by a build — a fixer is confirming):
- An enum's `__EnumType` conformance is **synthesized late**: `visitEnumDecl` adds the synthesized `__EnumType` `InheritanceDecl`+witness table only once the enum reaches `DeclCheckState::ReadyForLookup` (source/slang/slang-check-decl.cpp ~12300; dispatch :17887-17890). Before that the enum genuinely has no `__EnumType` base.
- Conformance at a call site is decided from a **cached** inheritance-info / subtype-witness facet list: `isSubtype` → `getInheritanceInfo(subType).facets` (slang-check-conformance.cpp:51-66, :269-289; negative witnesses cached too, `cacheSubtypeWitness` :120-137). `_calcInheritanceInfo` reads bases via `getMembersOfType<TypeConstraintDecl>` (slang-check-inheritance.cpp:867) and never `ensureDecl`s the SUBJECT to ReadyForLookup.
- The cache is validated ONLY against per-decl **extension epochs** (`_isInheritanceInfoCacheEntryUpToDate`, slang-check-inheritance.cpp:30-40). Adding the synthesized conformance in `visitEnumDecl` bumps NO epoch and calls NO `invalidateInheritanceInfo`.
- ⇒ If any decl checked before the enum's ReadyForLookup queries the enum's inheritance (extensions are driven ReadyForLookup-FIRST, slang-check-decl.cpp:5290-5300, so an `extension` touching the enum is the prime trigger), a NEGATIVE result is cached and never refreshed → the later generic call reads the stale negative → E38029 (emit slang-check-overload.cpp:1303).

General lesson: a lazily-synthesized conformance/base combined with a cache whose invalidation only tracks a DIFFERENT event (extension epochs) is an order-dependent false-negative trap. Fixing it must sit where the facet list is BUILT (force `ensureDecl(subject, ReadyForLookup)` first) or must invalidate the cache on the late `addMember` — guarding only `isSubtype` with `ensureDecl` is INSUFFICIENT because the poison is cached by an earlier caller and the epoch check keeps it "valid" after the enum advances. Related (not dup): #12540 (enum witness-table family), #12822 (module-scope on-demand conformance).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788776018731-enum-enumtype-conformance-failing-in-multi-file-in.md`_
