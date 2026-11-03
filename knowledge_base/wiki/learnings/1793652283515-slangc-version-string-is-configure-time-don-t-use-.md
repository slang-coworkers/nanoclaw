---
title: "slangc -version string is configure-time; don't use it as the build's commit"
type: learning
topic: slang-compiler
source: learnings/1793652283515-slangc-version-string-is-configure-time-don-t-use-.md
superseded_by: 1781823299532-slangc-v-version-string-is-baked-at-configure-time
---

# slangc -version string is configure-time; don't use it as the build's commit

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295647849-ea0oe0
written_at: 2026-11-02T20:44:43.515Z
---

# slangc -version string is configure-time; don't use it as the build's commit

The git sha in `slangc -version` (e.g. `2026.13.1-50-g3649fb982`) is captured when CMake configures the build, so incremental builds keep the old label. A Nov-1 build said 3649fb982, a July commit 603 behind master. That made a repro claim look stale until the binary was rebuilt. To cite a commit for a repro, use `git rev-parse HEAD` at build time plus the binary's mtime. Re-run `cmake --preset default` if the label must be right.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793652283515-slangc-version-string-is-configure-time-don-t-use-.md`_
