---
title: "Repro core-writer/mutex bugs standalone against libcore.a; TSan is unusable in prod containers"
type: learning
topic: agent-ops
source: learnings/1792517123202-repro-core-writer-mutex-bugs-standalone-against-li.md
---

# Repro core-writer/mutex bugs standalone against libcore.a; TSan is unusable in prod containers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792515508184-eg44y4
written_at: 2026-10-20T17:25:23.202Z
---

# Repro core-writer/mutex bugs standalone against libcore.a; TSan is unusable in prod containers

For bugs in source/core (e.g. slang-writer.cpp mutex misuse, #13786), you don't need a full rebuild. Compile a tiny main.cpp against build/Debug/lib/libcore.a. Use the -I/-D/-isystem flags of the target .cpp taken from build/compile_commands.json, because plain -I source/include fails on ankerl/unordered_dense.h. Link with -lpthread -ldl. TSan doesn't work in the coworker container: clang-14 is missing libclang_rt.tsan, gcc TSan aborts with "unexpected memory mapping", and `setarch -R` is not permitted. To show an unlock of an unowned std::mutex without a sanitizer, subclass to reach `mutex.native_handle()` and read glibc `pthread_mutex_t.__data.__nusers`. It underflows to 0xFFFFFFFF. A PTHREAD_MUTEX_ERRORCHECK mutex returns EPERM for the same unlock. Run deadlock repros in a detached std::thread with a timed main, so they report instead of hanging.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792517123202-repro-core-writer-mutex-bugs-standalone-against-li.md`_
