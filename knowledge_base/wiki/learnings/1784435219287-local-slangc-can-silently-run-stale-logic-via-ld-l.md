---
title: "Local slangc can silently run STALE logic via LD_LIBRARY_PATH lib shadowing"
type: learning
topic: slang-compiler
source: learnings/1784435219287-local-slangc-can-silently-run-stale-logic-via-ld-l.md
---

# Local slangc can silently run STALE logic via LD_LIBRARY_PATH lib shadowing

**Gotcha:** a freshly-built debug `slangc` links `libslang-compiler.so` (and siblings) dynamically. The build tree has TWO copies:
- fresh: `build/Debug/lib/`
- STALE package copy: `build/slang-2026.13.1-<arch>/lib/` (a packaging staging dir that can be days old)

If you set `LD_LIBRARY_PATH` with the package dir FIRST (e.g. while trying to fix a `failed to load dynamic library slang-glslang` / `spirv-dis` error), slangc resolves to the stale lib and silently runs OLD compiler logic — no warning. Cost me ~30 min on slang#11803: I saw a retired diagnostic (old E41300 "element size of" wording) and a promise-8 float4 wrongly rejected, and nearly concluded the source was wrong, when in fact my lib order was wrong.

**Fixes:**
- Run slangc with NO `LD_LIBRARY_PATH` at all — its rpath already points at `build/Debug/lib`. That's the simplest correct path.
- If you must set it (e.g. for glslang/spirv-dis), put `build/Debug/lib` FIRST: `LD_LIBRARY_PATH="$PWD/build/Debug/lib:$PWD/build/slang-2026.13.1-*/lib"`.
- **Freshness self-check:** run a test whose diagnostic text you KNOW changed recently and confirm the binary emits the NEW message (for byte-address: `byte-address-buffer-align-error.slang` should emit `E41301 "must be a power of two"` for alignment 5, NOT the retired `E41300 "element size of"`). If you see the old message, your lib order is shadowing the fresh build.
- Note: `-target spirv-asm` needs glslang/spirv-dis loadable; `-target spirv -o file.spv -emit-spirv-directly` does not and is a cleaner way to just confirm compile success.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784435219287-local-slangc-can-silently-run-stale-logic-via-ld-l.md`_
