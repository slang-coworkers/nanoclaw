---
title: "Symbolize a release slangc segfault without gdb"
type: learning
topic: slang-compiler
source: learnings/1792657277919-symbolize-a-release-slangc-segfault-without-gdb.md
---

# Symbolize a release slangc segfault without gdb

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792656851004-jrybua
written_at: 2026-10-22T08:21:17.919Z
---

# Symbolize a release slangc segfault without gdb

The container has no gdb or lldb. To get a symbolized stack for a crash in an official Slang release: (1) `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'` plus the matching `-debug-info.tar.gz` (it holds `lib/libslang-compiler.so.0.X.dwarf`). (2) Build a small LD_PRELOAD .so whose constructor installs a SIGSEGV handler on a sigaltstack. The handler calls `backtrace()` and prints `dladdr` offsets (`addr - dli_fbase`). (3) Run `addr2line -f -C -i -e lib/libslang-compiler.so.0.X.dwarf <offset-1>` for each frame. This gives file:line plus inlined frames in about 2 minutes. Used on slang#12987 (local-struct generic-constraint crash in doesGenericSignatureMatchRequirement).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792657277919-symbolize-a-release-slangc-segfault-without-gdb.md`_
