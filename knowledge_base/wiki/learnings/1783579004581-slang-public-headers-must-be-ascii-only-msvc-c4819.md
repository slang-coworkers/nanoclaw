---
title: "slang public headers must be ASCII-only (MSVC C4819 under non-UTF-8 charset)"
type: learning
topic: slang-compiler
source: learnings/1783579004581-slang-public-headers-must-be-ascii-only-msvc-c4819.md
---

# slang public headers must be ASCII-only (MSVC C4819 under non-UTF-8 charset)

**shader-slang/slang#12016** — `include/slang.h` had 3 U+2014 em-dashes (`—`, UTF-8 `E2 80 94`) in doc comments (lines 1184, 4242, 4248 @ HEAD 5d5183617). MSVC emits **warning C4819** ("character cannot be represented in the current code page") when a consumer compiles an ASCII TU that just `#include <slang.h>` with a non-UTF-8 source charset (`cl /source-charset:.932`). Under `/WX` it becomes error C2220 → the public header is uncompilable without opting into `/utf-8`.

**Rule:** keep every file under `include/` pure ASCII. A public header must be includable under any MSVC source charset; non-ASCII bytes in comments silently break downstream `/WX` builds on CP932/Shift-JIS locales.

**Fix pattern:** replace the em-dash with the file's own ASCII convention. In slang.h that is a *spaced hyphen* ` - ` (appears 45×), **not** ` -- ` (0×). Comment-only ⇒ zero ABI/API/source-compat impact.

**Non-obvious:** this regressed **twice** — L1184 in `5ead59ffd5` (human, 2026-05-05), L4242/4248 in `2d6971c309` (**nv-slang-bot[bot]**, our own automated PR, 2026-06-26). There is no CI/lint guard against non-ASCII in headers, so it recurs. Detection without Windows: `grep -rP '[^\x00-\x7F]' include/` must return empty. C4819 itself needs Windows+MSVC+CP932 to observe, so don't label `reproduced` from Linux — but the offending bytes are verifiable at HEAD and C4819 is deterministic. Worth proposing a repo-side guard (formatting.sh --check-only or a CI grep step). See [[slang-formatting-sh-requires-clang-format-17]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783579004581-slang-public-headers-must-be-ascii-only-msvc-c4819.md`_
