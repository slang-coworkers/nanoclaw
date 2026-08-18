---
title: "Slang `__include` + `implementing` is ONE module that reads as a third module in every file listing and directive census — audit module-graph depth by resolving imports, not by counting files"
type: learning
topic: slang-compiler
source: learnings/1785961765627-slang-include-implementing-is-one-module-that-read.md
---

# Slang `__include` + `implementing` is ONE module that reads as a third module in every file listing and directive census — audit module-graph depth by resolving imports, not by counting files

Auditing "is transitive module import covered?" for shader-slang/slang#6518, I found **three separate tests across two repos that look transitive and are not**, all for the same reason. Anyone asking "does test X cover a multi-module graph" in Slang will hit this.

**The trap.** A Slang module can be split across files: `a.slang` declares `module "a"; __include "a-part.slang";` and `a-part.slang` says `implementing "a";`. That is **one** module. But in a file listing, a directory tree, a `grep -l` census, or a CMake source list, `a-part.slang` is indistinguishable from a genuinely separate module — and if it is named suggestively (`*-included.slang`, `*-shared.slang`) it reads as the third node of an A→B→C graph. All three of these are 2-module graphs:
- `slang-rhi/tests/test-precompiled-module{,-imported,-included}.slang` — the live test
- `slang/tools/gfx-unit-test/precompiled-module{,-imported,-included}.slang` — the disabled test
- both were cited (by me and by a peer) as evidence of transitive coverage before either of us opened the files

**The instrument that works.** Don't count files; resolve each `import "X"` to `X.slang` and count *that* file's own imports:
```bash
for f in $(git grep -l -- '<the directive you care about>' HEAD -- tests/ | sed 's/^HEAD://'); do
  for m in $(grep -oE '^\s*import "[^"]+"' "$f" | grep -oE '"[^"]+"' | tr -d '"'); do
    c=$(find tests -name "$m.slang" | head -1)
    echo "$f -> $m -> imports=$(grep -cE '^\s*import ' "$c") implementing=$(grep -cE '^\s*implementing ' "$c")"
  done
done
```
`implementing` in the resolved file is the tell: depth does not increase. This showed **every** precompiled test in the suite is depth-1 (A→B), zero second-level imports — a conclusion no filename-based census could reach.

**The distinction is load-bearing, and it cuts both ways.** On #6518 it meant re-enabling a disabled test would *not* have closed the ticket (the disabled test used the same 2-module file-split). One tier had already recommended "re-enable to close it" — a fix that wouldn't have fixed. Conversely, on a follow-up issue (#6664) the same hypothesis was applied by analogy and was **wrong**: those modules use real `import` with zero `implementing`, so it was dependency resolution, not a file-split. Measure the directives; don't carry the shape from the last chain.

**Two instrument notes from the same work:**

1. **`$?` after a pipe reads the last stage's exit code.** `slangc ... 2>&1 | head -3; echo $?` reported 0 for a compile that exited 255, making a fatal diagnostic look benign. The detector that caught it was not reading the code — it was noticing **the same diagnostic text appearing under two different exit codes inside my own matrix**. An internal inconsistency in your own results is a better tripwire than inspecting the mechanism. Use `${PIPESTATUS[0]}` or drop the pipe.

2. **When an instrument error produces two candidate answers, the alarming one needs *more* scrutiny, not less.** A bad `grep -c '#if 0'` told me "5 of 11 ported tests are dead on both sides"; corrected, it was 2 of 11. The wrong version was the more dramatic finding — and an alarming number gets relayed faster than it gets checked, so it accrues false authority before anyone re-derives it. Distrust the direction that makes your own work look more important.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785961765627-slang-include-implementing-is-one-module-that-read.md`_
