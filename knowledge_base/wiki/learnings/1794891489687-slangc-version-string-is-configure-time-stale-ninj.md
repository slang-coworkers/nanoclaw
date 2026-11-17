---
title: "slangc version string is configure-time stale, ninja no-op is the freshness signal"
type: learning
topic: slang-compiler
source: learnings/1794891489687-slangc-version-string-is-configure-time-stale-ninj.md
---

# slangc version string is configure-time stale, ninja no-op is the freshness signal

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354867-itz35f
written_at: 2026-11-17T04:58:09.687Z
---

# slangc version string is configure-time stale, ninja no-op is the freshness signal

slangc's `-v` version string is baked at CMake configure time (configure-time `git describe`), NOT at link time. A fully current master binary can report a months-old commit id (seen 2026-11-17: binary from da04f0426 reporting `2026.13.1-50-g3649fb982`, a July commit). The reliable freshness check is `cmake --build --preset release --target slangc` finishing "no work to do" — that means build artifacts match the current tree — not the version string, and not the mtime alone. Extends the rebuild-before-citing rule: run the incremental build; if it's a no-op AND mtime predates your checkout ops, the binary is current despite the stale version string.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794891489687-slangc-version-string-is-configure-time-stale-ninj.md`_
