---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-10-30T22:45:19.361Z
---

# render-test DeviceCache ignored the Slang global session (hid -load-core-module failures)

`tools/render-test/slang-test-device-cache.cpp` keyed cached RHI devices by device type/profile/flags but NOT `desc.slang.slangGlobalSession`. RenderTestApp compiles with `device->getSlangSession()->getGlobalSession()`, so on a cache hit a test that render-test gave a fresh core-module-less session (`hasDeferredCoreModule`, e.g. `-compile-arg -load-core-module x.zip`) compiled against the previous test's shared session instead. Symptom: `std-lib-serialize.slang.4 syn (llvm)` passes alone, fails after ANY earlier render-test test in the same slang-test process. It was invisible because `IGlobalSession::parseCommandLineArguments` returned SLANG_OK on parse failure; fixed in the #14103 PR by adding the session to the key. Lesson: when a test passes alone and fails after unrelated tests, suspect a process-wide cache whose key misses an input.
