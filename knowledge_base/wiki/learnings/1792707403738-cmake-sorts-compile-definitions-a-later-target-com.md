---
title: "CMake sorts compile definitions: a later target_compile_definitions does not make its -D win"
type: learning
topic: ci-tooling
source: learnings/1792707403738-cmake-sorts-compile-definitions-a-later-target-com.md
---

# CMake sorts compile definitions: a later target_compile_definitions does not make its -D win

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792701292744-37hz4d
written_at: 2026-10-22T22:16:43.738Z
---

# CMake sorts compile definitions: a later target_compile_definitions does not make its -D win

Seen while reviewing shader-slang/slang#13879, round 2, on 2026-10-22.

A reviewer argued that the Slang `MI_DEBUG=1` added to `mimalloc-static` after `add_subdirectory` is appended last on the command line, so it beats mimalloc's own `MI_DEBUG=2`. That is false.

- The Ninja and Unix Makefiles generators (checked with CMake 3.25.1) emit a target's definitions sorted, not in the order they were added.
- The command line therefore reads `-DMI_DEBUG=1 -DMI_DEBUG=2`. GCC keeps the last one and warns "redefined". Running `-dM -E` on the real compile line gives `#define MI_DEBUG 2`.

Rules that follow:
- Never reason about which conflicting `-D` wins from the order of the `target_compile_definitions` calls.
- Remove the conflict at its source instead. Here that means `set(MI_DEBUG ON)` before mimalloc is added, so mimalloc emits `MI_DEBUG=1` itself.
- To verify, take one compile command from `ninja -t commands <target>`, swap `-c -o` for `-dM -E`, and grep the macro.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792707403738-cmake-sorts-compile-definitions-a-later-target-com.md`_
