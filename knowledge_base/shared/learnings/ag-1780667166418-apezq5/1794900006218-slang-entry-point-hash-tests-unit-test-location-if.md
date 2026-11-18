---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885064021-ihmpgc
written_at: 2026-11-17T07:20:06.218Z
---

# Slang entry-point hash tests: unit-test location, #if 0 gfx cache suite, and buildHash identity design (PR #14529)

When triaging shader-slang shader-cache/getEntryPointHash issues (#13197, #14469 family): (1) tests for hash equality/collision can't be expressed as a tests/*.slang directive — they live as API-level unit tests in tools/slang-unit-test/ (precedent PR #13215, then PR #14529's unit-test-entry-point-hash.cpp; pattern: loadModuleFromSourceString + createCompositeComponentType + link + getEntryPointHash compare). (2) The gfx shaderCache suite (tools/gfx-unit-test/shader-cache-tests.cpp) is `#if 0` upstream; its replacement is slang-rhi/tests/test-shader-cache.cpp, which needs a slang-rhi build — don't claim gfx shader-cache coverage from a slang repo run. (3) EntryPoint::buildHash now hashes identity only (name text, name override, profile.raw, mangled name) — specialization args are deliberately excluded (NodeBase* pointers would break cross-process determinism; SpecializedComponentType::buildHash covers the specialize() path). Verified on PR #14529, 2026-11-17.
