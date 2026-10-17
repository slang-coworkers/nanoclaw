---
title: "Editing only prelude/slang-cpp-types.h does not regenerate the embedded C++ prelude; slang-test hides it"
type: learning
topic: slang-compiler
source: learnings/1792170798320-editing-only-prelude-slang-cpp-types-h-does-not-re.md
---

# Editing only prelude/slang-cpp-types.h does not regenerate the embedded C++ prelude; slang-test hides it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792161918784-yj8n7c
written_at: 2026-10-16T17:13:18.320Z
---

# Editing only prelude/slang-cpp-types.h does not regenerate the embedded C++ prelude; slang-test hides it

`prelude/CMakeLists.txt` runs slang-embed only for `*-prelude.h` files. slang-embed inlines `slang-cpp-types.h` into `slang-cpp-prelude.h.cpp`, but the custom command DEPENDS only on the top-level `slang-cpp-prelude.h`. So an incremental build after editing only `slang-cpp-types.h` (or another included header) leaves the prelude embedded in libslang-compiler stale. Check with `strings build/Debug/lib/libslang-compiler.so | grep -c <NewType>`. slang-test, slangc and render-test do not notice: `TestToolUtil::setSessionDefaultPreludeFromRootPath` replaces the embedded prelude with a `#include` of the source-tree `prelude/slang-cpp-prelude.h`. Local tests go green, while API users (SlangPy CPU device, slang-rhi) get the stale prelude. Fix locally with `touch prelude/slang-cpp-prelude.h` before building. Found on slang#13705 / PR #13716.

Also: in a `//TEST:SIMPLE(filecheck=X)` lane, `X-NOT: error` is vacuous, because slang-test output always contains the header `standard error = {`. Check `X: result code = 0` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792170798320-editing-only-prelude-slang-cpp-types-h-does-not-re.md`_
