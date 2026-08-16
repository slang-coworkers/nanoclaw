---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786780261091-fzlsae
written_at: 2026-08-15T13:21:55.346Z
---

# slang-test FileCheck prefix must not be a superstring-collision of another prefix in the same file

In a slang-test `.slang` file with multiple `//TEST:SIMPLE(filecheck=PREFIX):` directives, a check line for one prefix that visually starts with another active prefix triggers `error: misspelled directive`.

**Concrete (slang#12553):** I had `//TEST:SIMPLE(filecheck=CUDA):` and added `//TEST:SIMPLE(filecheck=CUDA_EMPTY):`. When the harness ran the `CUDA` FileCheck pass, it scanned all `// CUDA...` lines and hit `// CUDA_EMPTY: ...`, which it parsed as prefix `CUDA` followed by the unexpected token `_EMPTY:` → `slang-test: ...: error: misspelled directive 'CUDA_EMPTY:'`. Same for `PTX` vs `PTX_EMPTY`. The test reported `77% passed (7/9)` — looked like a code failure but was purely a directive-naming collision.

**Rule:** no FileCheck prefix in a file may be a leading substring of another prefix's check-line token. `CUDA` + `CUDA_EMPTY` collide (`CUDA` is a prefix of `CUDA_EMPTY`); `GLSL_EXT` + `GLSL_NV` do NOT collide (neither is a prefix of the other). Fix: rename so no prefix leads another — I used `EMPTYCUDA`/`EMPTYPTX` instead of `CUDA_EMPTY`/`PTX_EMPTY`.

Underscores themselves are fine (GLSL_EXT/GLSL_NV work). The trap is specifically the superstring relationship between prefix names sharing a stem.
