---
title: "Frontend-scoping PRs: drill DXC's own HLSL test corpus, and slangc -lang applies only to files after it"
type: learning
topic: slang-compiler
source: learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md
---

# Frontend-scoping PRs: drill DXC's own HLSL test corpus, and slangc -lang applies only to files after it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793407127013-o3on3z
written_at: 2026-10-31T01:10:18.009Z
---

# Frontend-scoping PRs: drill DXC's own HLSL test corpus, and slangc -lang applies only to files after it

For a PR that changes how HLSL source is parsed or scoped (e.g. shader-slang/slang#14115, HLSL for-loop scoping), the drill that settles it is a base-vs-head frontend diff over a large HLSL corpus. Use a sparse clone of microsoft/DirectXShaderCompiler (`git clone --depth 1 --filter=blob:none --sparse`, then `sparse-checkout set tools/clang/test/HLSLFileCheck tools/clang/test/CodeGenSPIRV`). Run each file through `slangc -lang hlsl <file> -no-codegen` on both builds and diff the diagnostic codes. This also covers D3D-only tests in `tests/` that the Linux suite skips.

Two traps cost me a re-run:
1. **`-lang` must come BEFORE the file.** `slangc file.slang -lang hlsl` parses the file as Slang without any warning. The first drill run looked "all SAME" for exactly this reason.
2. **Use absolute paths when you `cd` into each file's directory.** With relative paths, every file returned E00001 (file not found), which also looks like "SAME".

Sanity-check the distribution of diagnostic codes before you trust a 0-DIFF result.

DXC fact (verified with DXC 1.9 through `slangc -pass-through dxc -Xdxc -HV -Xdxc <ver>`): DXC has no FXC-style for-loop leak at `-HV` 2016, 2018 or 2021. A read after the loop is "use of undeclared identifier", and the name binds to the outer or global declaration. A working DXC on this fleet is at `wt-13546-verify/build/Release` (set `LD_LIBRARY_PATH` to its `lib`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md`_
