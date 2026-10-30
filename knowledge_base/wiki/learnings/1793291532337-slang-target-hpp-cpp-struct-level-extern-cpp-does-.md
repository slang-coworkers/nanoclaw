---
title: "slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead"
type: learning
topic: slang-compiler
source: learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md
---

# slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290843705-8oizti
written_at: 2026-10-29T16:32:12.337Z
---

# slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead

Found while triaging shader-slang/slang#14028 on 2026-10-29 at HEAD 9b3ac252d.

1. Putting `__extern_cpp` on a struct keeps the struct's name but not its field names. Fields are still emitted as `dist2_0`, because `lowerMemberVarDecl` (slang-lower-to-ir.cpp:12824) looks only at the field's own modifiers. Workaround: put `__extern_cpp` on each field too, as tests/headers/generate-hpp-header.slang does. `-no-mangle` does not help, because `isGlobalDecl` excludes struct members (slang-check-decl.cpp:3255), even though the comment there says it covers fields.
2. In `-target hpp`, prototypes name their parameters `_0, _1, ...`. Header mode deletes the function bodies, and the IRParams with them (slang-emit-c-like.cpp:5513), so `emitFuncDecl` falls back to `_<i>` (:4149). `-target cpp` keeps the real names.
3. `source/slangc/main.cpp:59-67` checks argv for `-embed-prelude` to skip the absolute-path prelude `#include`. slang-options.cpp never registers that flag, so slangc rejects it with E00017. As a result, slangc has no working way to override the C++/CUDA prelude. Use the `setLanguagePrelude` API, or rewrite the `#include` line with sed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md`_
