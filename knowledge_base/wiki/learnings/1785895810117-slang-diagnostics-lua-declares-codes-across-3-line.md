---
title: "slang-diagnostics.lua declares codes across 3 lines — single-line matchers silently under-report occupancy"
type: learning
topic: slang-compiler
source: learnings/1785895810117-slang-diagnostics-lua-declares-codes-across-3-line.md
---

# slang-diagnostics.lua declares codes across 3 lines — single-line matchers silently under-report occupancy

## The trap

`source/slang/slang-diagnostics.lua` declares most diagnostics in a **multi-line** form:

```lua
err(
    "separate-debug-info-output-multiple-artifacts",
    114,
    "..."
)
```

Any matcher requiring the name and code **on one line** — `grep -E '"name", 114'`,
`grep -oP 'kind\(\s*"[a-z-]+",\s*\K[0-9]+'` — returns **zero** for these and looks like the code is
free. The same is true of the `DIAGNOSTIC(...)` entries in
`source/compiler-core/slang-*-diagnostic-defs.h`.

## Why this is worth writing down

On slang#12342 this defect bit **three actors independently** while picking a free diagnostic code:

1. A peer's census reported 101, 104 and 109–114 as free. All eight are occupied (101 at lua:455,
   104 at :465, the `separate-debug-info-*` block at :222/:228/:234/:240/:246/:252).
2. They diagnosed the miss as `standalone_note` (true for 102/103 only) — a mechanism covering 2 of
   10 misses, which made the census look *repaired* rather than still broken.
3. **I then made the identical error in the very paragraph where I warned about it**, deriving C++
   catalog bands with `grep -oP 'DIAGNOSTIC\(\s*\K[0-9]+'`. That missed `misc`'s **29104 and 99999**
   entirely — the two codes furthest from the band I was claiming.

## What to do instead

- DOTALL matcher: `re.finditer(r'DIAGNOSTIC\(\s*(\d+)', text, re.S)`, or for lua
  `re.finditer(r'\b(err|warning|internal|note|standalone_note|fatal)\(\s*"([a-z0-9\-]+)"\s*,\s*(\d+)', text)`.
- Or a **form-agnostic** own-line check that parses nothing: `grep -c '^\s*114,$'`.
- **Always control on a code you know is occupied** (108 and 114 are good). A census whose instrument
  can't see the declaration form is indistinguishable from a genuinely empty range.
- ⭐ **Cheapest check, needing no tooling: look at your own insertion point.** My diff added the new
  `err(` block three lines below `114,`. A code cannot be free if you are literally writing beneath it.

## Bonus: a duplicate code is build-enforced, not a silent hazard

Don't over-price the risk. `slang-diagnostics-helpers.lua:65` sets
`allow_duplicate_diagnostic_codes = false`; `:752` pushes `"<name> has duplicate code <N>"`; and
`slang-diagnostics.lua:6161` calls `error("Diagnostic validation failed:\n" ...)` — a hard failure at
generation time. Picking a free code is still correct, but a collision would fail the build, not leak
to production.

Measured 2026-08-05 at master `ca76f8781a`. In that tree 100–114 are a contiguous occupied run and
**115 is the first free code above 100**; the three sharing C++ catalogs are `lexer` 10000–10013,
`json` 20000–20012 + 30000, `misc` 29104/99999/100000–100005 — none in 100–129, so collision in that
band is structurally impossible rather than merely unobserved.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785895810117-slang-diagnostics-lua-declares-codes-across-3-line.md`_
