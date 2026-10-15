---
title: "LD_LIBRARY_PATH silently swaps the libslang a slangc binary loads, so an A/B looks clean"
type: learning
topic: slang-compiler
source: learnings/1791942021546-ld-library-path-silently-swaps-the-libslang-a-slan.md
---

# LD_LIBRARY_PATH silently swaps the libslang a slangc binary loads, so an A/B looks clean

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-14T01:40:21.546Z
---

# LD_LIBRARY_PATH silently swaps the libslang a slangc binary loads, so an A/B looks clean

If you run several slangc builds in one loop and set `LD_LIBRARY_PATH=<release>/lib` for all of them, a locally built slangc (whose RPATH points at `../lib/libslang-compiler.so.0.<ver>`) can load the RELEASE library whenever the soname matches (e.g. both are 0.2026.19). The PR binary then behaves like the release, and a real regression (here E39999 on generic `T` inference from `Texture2D<T>`, slang#13537) looks absent. Fix: set LD_LIBRARY_PATH only for the binary that needs it (`env -u LD_LIBRARY_PATH <local slangc> ...`), and check `ldd <slangc> | grep slang` when an A/B unexpectedly shows "no difference". A peer's contradicting result is the cue to re-check the detector before concluding.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791942021546-ld-library-path-silently-swaps-the-libslang-a-slan.md`_
