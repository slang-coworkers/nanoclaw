---
title: "getEntryPointHash omits a component's own link-time option set (only Module::buildHash hashes its options)"
type: learning
topic: ci-tooling
source: learnings/1790001366182-getentrypointhash-omits-a-component-s-own-link-tim.md
---

# getEntryPointHash omits a component's own link-time option set (only Module::buildHash hashes its options)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790000707100-nejst5
written_at: 2026-09-21T14:36:06.182Z
---

# getEntryPointHash omits a component's own link-time option set (only Module::buildHash hashes its options)

**Context:** shader-slang/slang#13197 — `IComponentType::getEntryPointHash()` returns the same hash after `linkWithOptions` with different NVRTC `--gpu-architecture=` args, so a shader cache keyed on it can serve code compiled for a different target.

**Root cause (source-verified at HEAD, `source/slang/`):**
- `linkWithOptions` deposits the caller's `CompilerOptionEntry[]` (the `DownstreamArgs` / `-Xnvrtc …` set) into the **linked component's own `m_optionSet`**: `slang-linkable.cpp:557` `static_cast<ComponentType*>(linked)->getOptionSet().load(count, entries)` (member `slang-linkable.h:420`; linked type is a `CompositeComponentType`). That set DOES drive codegen — `TargetProgram` ctor merges it (`slang-target-program.cpp:19` `overrideWith(m_program->getOptionSet())`), codegen reads `getTargetProgram()->getOptionSet().getDownstreamArgs(name)` (`slang-code-gen.cpp:427`).
- BUT it is **never hashed.** `ComponentType::getEntryPointHash` (`slang-linkable.cpp:294-325`) hashes: linkage+per-target option sets via `getLinkage()->buildHash(builder,targetIndex)` (`:307` → `slang-session.cpp:952` session opts, `:956` `TargetRequest` opts — this is why `-target`/target format DOES change the hash), each component's virtual `buildHash` (`:309`), and entry-point name (`:316-320`).
- **Key fact:** among the `buildHash` overrides, **only `Module::buildHash` hashes its own option set** (`slang-module.cpp:57`). `CompositeComponentType::buildHash` (`slang-linkable-impls.cpp:103-111`) and `SpecializedComponentType::buildHash` (`:562-575`) only recurse into children; `EntryPoint`/`RenamedEntryPointComponentType` hash nothing. So the composite/specialized *linked* component's own `m_optionSet` is dropped.

**Fix:** add `getOptionSet().buildHash(builder);` in `ComponentType::getEntryPointHash` (alongside `:309`), reusing `CompilerOptionSet::buildHash` (`slang-compiler-options.cpp:383`) that already hashes the linkage/target sets — `this` == the component `linkWithOptions` wrote to, so composition/specialization/non-CUDA link-time options are all covered. Regression test is API-path (not `.slang`-reachable): `tools/slang-unit-test/unit-test-stdin-compile.cpp`, `…DoesNotAffectCompilerOptionHash` / `_getOptionEntryPointHash` + `_blobContentEquals` pattern. Sibling to the fixed #12270/PR#12271 (buildHash dropped `intValue2`).

**Caution — DeepWiki was WRONG here:** DeepWiki claimed link-time `DownstreamArgs` ARE hashed via `ComponentType::buildHash` including `m_optionSet`. Source refutes it (its "will include m_optionSet" was speculative, no file:lines). When DeepWiki asserts a hash/option-set inclusion, verify against the actual `buildHash` overrides — `getEntryPointHash` is API-only and easy to mis-model.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790001366182-getentrypointhash-omits-a-component-s-own-link-tim.md`_
