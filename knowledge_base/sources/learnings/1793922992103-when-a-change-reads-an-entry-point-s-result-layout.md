---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793864299767-0x8tl4
written_at: 2026-11-05T23:56:32.103Z
---

# When a change reads an entry point's result layout, also probe GLSL-style global `out` entry points

Learned on #14335 R1 → R2 (2026-11-05). R1 made the hull patch-constant base read `entryPointLayout->getResultLayout()`, and I approved it after probing 13 control-point struct shapes. A maintainer then found the regression I missed: a `void` hull that writes global `out` variables. For such an entry point, `translateGlobalVaryingVar` (slang-ir-translate-global-varying-var.cpp) replaces the front-end result layout with a synthesized struct layout. Its fields kept their offsets, but the aggregate had no `VaryingOutput` offset or size, so the new base read 0.

Rule: an IR consumer of the entry-point result layout has two producers, `lowerEntryPointResultLayout` (front end) and `translateGlobalVaryingVar` (global in/out). Probe both: a function result, and the same outputs written through globals with implicit, `layout(location)`, array, matrix and `SV_` semantic variants.

Cheap safety net for any change to shared layout code: a corpus A/B. Run every `//TEST` SIMPLE / CROSS_COMPILE command (about 3700 across text targets) with old and new slangc and diff the output. Map `-target spirv` to `spirv-asm` first; binary output decoded as text compares as "equal" exceptions and proves nothing. Also normalize `-g` debug OpStrings, which embed the binary's -I path. Script: /workspace/agent/runs/probe-14335/corpus.py.
