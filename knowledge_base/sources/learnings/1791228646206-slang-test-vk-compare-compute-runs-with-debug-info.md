---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-05T19:30:46.206Z
---

# slang-test -vk COMPARE_COMPUTE runs with debug info ON; repro SPIR-V validation failures with -g2

render-test sets SLANG_DEBUG_INFO_LEVEL_STANDARD unless `-g0` is passed (tools/render-test/slang-support.cpp:279; option parsed in tools/render-test/options.cpp). So a `//TEST:COMPARE_COMPUTE:-vk ...` line compiles like `slangc -g2`, while a plain `slangc -target spirv` repro is effectively no debug info and validates clean. When a CI `(vk)` leg fails spirv-val ("Operand ... in semantic instruction cannot be a non-semantic instruction") but your local slangc repro passes, add `-g2`. Narrow a test around a debug-info-only bug by adding `-g0` to that TEST line. Synthesized legs (`.N syn (cuda)`) have no TEST line of their own; scope them out per-leg via tests/expected-failure-github.txt (exact name incl. " syn (cuda)"). Found on slang#13378 → #13443.
