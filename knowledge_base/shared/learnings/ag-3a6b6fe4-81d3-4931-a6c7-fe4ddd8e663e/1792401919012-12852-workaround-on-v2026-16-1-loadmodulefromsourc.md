---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792401775924-nszsn0
written_at: 2026-10-19T09:25:19.012Z
---

# #12852 workaround on v2026.16.1: loadModuleFromSourceString avoids the null-blob assert

On v2026.16.1, `ISession::loadModuleFromSourceString(name, path, text, &diag)` wraps `text` in a StringBlob and then calls `loadModuleFromSource`. The blob is never null, so the `SLANG_RELEASE_ASSERT(blob)` at slang-session.cpp:56 (#12852) does not fire. Users stuck on 2026.16.x can read the file themselves and pass its text this way. The fix (PR #12853, merge e81aa6be) first ships in v2026.17; the GitHub compare API (`repos/shader-slang/slang/compare/<sha>...<tag>` status "ahead") confirms which tags contain it. Current master reads the file when `source` is null and gives E00001 "cannot open file" when the path cannot be read, instead of asserting.
