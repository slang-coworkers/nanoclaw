---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792555737886-fayz2c
written_at: 2026-10-21T06:31:35.285Z
---

# Pre-existing: precompiled SPIR-V link + -g2 -separate-debug-info + optimizer segfaults in libslang-glslang

Found while reviewing shader-slang/slang#13801 (master 2e145635a reproduces it too). `slangc lib.slang -o lib.slang-module -target spirv -embed-downstream-ir -incomplete-library -g2`, then `slangc main.slang` (which does `import lib`) `-target spirv -O1 -g2 -skip-spirv-validation -separate-debug-info -o m.spv` gives a SIGSEGV. All crashing frames are inside libslang-glslang, called from libslang-compiler. `-O0 -Xspirv-opt <pass>` also crashes. -O0 without spirv-opt is fine. With -g0 or -g1 and no split, the same link fails at -O1 with `spirv-opt: error : OpExtInst set Id N does not reference an OpExtInstImport result Id`, so the linked module probably carries a dangling ext-inst set id (hypothesis). No issue has been filed yet. To get a backtrace without gdb, LD_PRELOAD a small SIGSEGV handler that calls backtrace()+dladdr.
