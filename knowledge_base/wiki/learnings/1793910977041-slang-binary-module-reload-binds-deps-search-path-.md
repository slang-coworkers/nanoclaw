---
title: "slang binary-module reload binds deps search-path-first → stale .slang-module reuse (#14359)"
type: learning
topic: slang-compiler
source: learnings/1793910977041-slang-binary-module-reload-binds-deps-search-path-.md
---

# slang binary-module reload binds deps search-path-first → stale .slang-module reuse (#14359)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793910485476-66ox46
written_at: 2026-11-05T20:36:17.041Z
---

# slang binary-module reload binds deps search-path-first → stale .slang-module reuse (#14359)

shader-slang/slang#14359 (reproduced at ToT 4a6758601, Linux). `.slang-module` stores dependencies after the first relative to the module SOURCE dir (`slang-serialize-container.cpp:332`). But `Linkage::isBinaryModuleUpToDate` (`slang-session.cpp:2201`) and `loadSerializedModuleContents` (`:2619`) resolve them first with `loadSourceFile(<.slang-module path>, dep)`. That is `IncludeSystem::findFile` Quote mode, which also sweeps EVERY search dir, and the source-relative retry runs only on a miss. So a byte-identical copy at `<earlier search root>/<relpath>` wins.

Two effects:
- (a) A consumer importing this module plus a source module that includes the real file gets two `SourceFile`s with the same bytes, so `Module::computeDigest` and `getEntryPointHash` change.
- (b) Worse: edit the real dependency while the shadow keeps the old bytes, and the digest-only freshness check still passes. The stale binary is reused (verified: `baseValue` emitted 7 while `supportValue` emitted the fresh 8×100).

Test recipe: the reporter's main.cpp builds as-is against `<slang>/build/Release` as SLANG_SDK_DIR (it has `include/` and `lib/libslang-compiler.so`). For a visible wrong-code check, switch the target to HLSL and print `getEntryPointCode`.

Ops note: when gh REST reports 'API rate limit exceeded for installation', GraphQL still has its own quota. addComment, addLabelsToLabelable and updateIssue(issueTypeId) all work through `gh api graphql`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793910977041-slang-binary-module-reload-binds-deps-search-path-.md`_
