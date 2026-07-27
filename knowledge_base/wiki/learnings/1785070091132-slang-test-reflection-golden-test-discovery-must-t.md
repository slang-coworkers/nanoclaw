---
title: "slang-test reflection/golden test discovery must tolerate TEST(category): suffix"
type: learning
topic: slang-compiler
source: learnings/1785070091132-slang-test-reflection-golden-test-discovery-must-t.md
---

# slang-test reflection/golden test discovery must tolerate TEST(category): suffix

**Rule:** When regenerating golden/expected outputs for a systematic change (e.g. every reflection-JSON `.expected`), discover the affected tests with a pattern that tolerates the **category suffix** in slang-test directives. The directive grammar is `//TEST[(<category>)]:<COMMAND>` — e.g. `//TEST:REFLECTION`, but also `//TEST(64-bit):REFLECTION`, `//TEST(smoke):REFLECTION`, `//TEST(compute):COMPARE_COMPUTE`.

**Broken (misses category-suffixed tests):**
```
grep -rlE "//[[:space:]]*TEST:(CPU_)?REFLECTION" tests/     # 60 hits
```
**Correct:**
```
grep -rlE "//[[:space:]]*TEST(\([^)]*\))?:(CPU_)?REFLECTION" tests/   # 68 hits — the (\([^)]*\))? catches (64-bit)/(smoke)/etc.
```

**Why it matters:** On shader-slang/slang#12225 (add `sizes` to every reflection-JSON type layout), the narrow pattern passed "99/99 local" but CI's `test-slang` failed **cross-platform** on 8 category-suffixed reflection tests (`actual-global`, `cross-compile`, `resource-in-cbuffer`, `ptr/ptr-*`, `acceleration-structure`) whose `.expected` never got regenerated. A cross-platform, deterministic `test-slang` failure right after a golden-output change = suspect incomplete regeneration, not a real compiler bug.

**Also learned:**
- `.32`/`.64` CPU_REFLECTION variants (`*.slang.32.expected` / `.64.expected`) are selected by `SLANG_PTR_IS_32` at test time. No CI job runs 32-bit (the wasm build job is build-only, doesn't run slang-test), so `.32` goldens are unvalidated and can drift stale on master itself. Don't hand-edit a golden you can't build+verify locally.
- A test `.slang` file with NO `//TEST` directive is never executed by slang-test — its `.expected` is dormant/orphaned.
- `.expected` is globally gitignored (`.gitignore: *.expected`); a NEW expected file needs `git add -f` (existing tracked ones show mods normally).
- `libslang-reflection-test-tool.so` (in `build/*/lib/`, NOT a `bin/` executable) is the reflection test tool; run reflection tests via `slang-test <files>`, which writes `.actual` on mismatch — the bless source (`cp *.actual → *.expected`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785070091132-slang-test-reflection-golden-test-discovery-must-t.md`_
