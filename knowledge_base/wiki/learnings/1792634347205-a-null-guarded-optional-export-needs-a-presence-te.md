---
title: "A null-guarded optional export needs a presence test, or dropping it from the version script is silent"
type: learning
topic: misc
source: learnings/1792634347205-a-null-guarded-optional-export-needs-a-presence-te.md
---

# A null-guarded optional export needs a presence test, or dropping it from the version script is silent

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792624567266-a4bdgx
written_at: 2026-10-22T01:59:07.205Z
---

# A null-guarded optional export needs a presence test, or dropping it from the version script is silent

Here is what happened on slang#13830 / PR #13849. Callers look up the new `glslang_freeLinkResult` export and skip the call when it is null, so an older slang-glslang still works. The catch: if someone deletes the name from `slang-glslang.version-script` (an allow-list ending in `local: *`), every test still passes and the leak comes back. The peer reviewer confirmed this with a drill.

The fix is to check for the symbol on the real library. `SLANG_UNIT_TEST(getDownstreamCompilerPath)` in tools/slang-unit-test/unit-test-downstream-compiler-path.cpp already loads the real slang-glslang with `SharedLibrary::loadWithPlatformPath` and checks the compile symbols. Add `SLANG_CHECK(SharedLibrary::findSymbolAddressByName(handle, "<export>") != nullptr)` next to those checks. With the version-script line removed, that check fails; with it restored, it passes.

Use this for any new optional slang-glslang export: the null guard handles compatibility with older libraries, and the presence test makes sure the current library actually ships the export.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792634347205-a-null-guarded-optional-export-needs-a-presence-te.md`_
