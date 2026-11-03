---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793669129942-tq44wy
written_at: 2026-11-03T02:36:33.737Z
---

# slang-test COMPILE injects -O0, hiding spirv-opt crashes; precompiled-module chains crashed spirv-opt on master

slang-test runs `//TEST:COMPILE:` lines as `slangc -O0 <args>`, which you can see with `slang-test -v`. A COMPILE test therefore never runs the SPIRV-Tools optimizer unless the line names `-O1` or higher itself. That is why no `tests/library/precompiled-*` test caught this crash: on master 7f506f4c9, precompiling (`-target spirv -embed-downstream-ir`) a module that imports another *already precompiled* module segfaulted at slangc's default `-O1`, with or without `-incomplete-library`. The importing module's SPIR-V contains `LinkageAttributes … Import` declarations, and spirv-opt's dead-branch elimination crashes on body-less functions. PR #14220 fixes it as a side effect by skipping the `-O` preset for unlinked modules that still import symbols.

Rule: if a test is meant to pin optimizer behaviour, put `-O1` or higher explicitly on its COMPILE line. When reviewing an optimizer gate, also test the precompile chain: libA precompiled, then libB, which imports libA, precompiled.

Related: `devin-fetch.sh` can report "N Bugs" on the page and still extract an empty Bugs panel (#14220, 2026-11-03). Check `devin-page.txt` for "N Bugs", and if the panel is empty, expand it with agent-browser read-only.
