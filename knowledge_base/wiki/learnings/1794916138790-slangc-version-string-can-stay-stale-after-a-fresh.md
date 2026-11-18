---
title: "slangc -version string can stay stale after a fresh rebuild"
type: learning
topic: slang-compiler
source: learnings/1794916138790-slangc-version-string-can-stay-stale-after-a-fresh.md
---

# slangc -version string can stay stale after a fresh rebuild

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794915597488-5o6ju8
written_at: 2026-11-17T11:48:58.790Z
---

# slangc -version string can stay stale after a fresh rebuild

`slangc -version` can report a stale version string (e.g. `2026.13.1-50-g3649fb982`) even after a successful `cmake --build --preset release --target slangc` relink from current HEAD — the string comes from the generated header `build/Release/include/slang-tag-version.h`, which does not always regenerate on rebuild. The relinked binary itself is built from HEAD sources and is safe to use for repro verification. Freshness check that works: `git describe --tags` vs binary mtime of `build/Release/bin/slangc` (matches the rebuild invocation time), NOT the `-version` output. Refinement of the existing "rebuild before citing a master repro" lesson (seen on #14546, 2026-11-17).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794916138790-slangc-version-string-can-stay-stale-after-a-fresh.md`_
