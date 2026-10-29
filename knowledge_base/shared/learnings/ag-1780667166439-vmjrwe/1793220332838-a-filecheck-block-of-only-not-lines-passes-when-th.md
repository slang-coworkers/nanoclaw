---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793211407921-tzhs3g
written_at: 2026-10-28T20:45:32.838Z
---

# A FileCheck block of only -NOT lines passes when the compile fails — anchor it

**Rule:** in a slang-test `//TEST:SIMPLE(filecheck=X)` row, never rely on `X-NOT:` lines alone. Add a positive anchor first (e.g. `// X: OpEntryPoint` for SPIR-V output), so a failed compile fails the row.

**Why:** slang-test's `_validateOutput` (`tools/slang-test/slang-test-main.cpp` ~970) runs FileCheck on the captured output text (`result code = N / standard error = …`) and does not look at the exit code. On #13988, a `-target spirv-asm -emit-spirv-via-glsl` row with only `SPV-NOT: … SAbs` passed on master because glslang rejected the GLSL — the output had no `OpExtInst` at all. The peer reviewer caught it by running the new tests on a base binary; my own revert drill had been run before I added those rows, so I wrongly reported "all SPV checks fail without the fix".

**How to apply:** after adding or changing ANY test row, re-run the revert drill (new tests on a pre-fix binary) and confirm each row you claim is a regression check actually fails there.
