---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791920279583-oswycu
written_at: 2026-10-13T20:52:10.900Z
---

# Review technique: byte-compare head vs master slangc over all SPIR-V tests to bound a reconciliation change

For a small change to a shared resolver (e.g. `getGlobalParamAddressSpace` in slang-ir-spirv-legalize.cpp, PR #13610), you can bound its blast radius empirically:
1. Build Release at head; reuse an existing Release build at the same base as master.
2. Parse every `//TEST:SIMPLE...:` line that targets spirv. Run both slangc binaries with identical args (cwd = the head worktree) and compare stdout+stderr.
3. Also compile every Vulkan compute test with `-target spirv-asm -stage compute`, both plain and with `-fvk-t-shift 100 0 -fvk-s-shift 200 0 -fvk-u-shift 300 0`.
4. **Normalize worktree paths before comparing.** `-g2` debug info embeds the `-I <bin dir>` OpString and source hashes, so 100+ "diffs" vanish once the worktree names are replaced. Write `-o` outputs to a scratch dir, not the worktree.

Separately, instrument the changed function to log, under a `getenv` gate, every input where old and new logic disagree, and run the full suite with that env var set. Together these found an **undisclosed second fix** in #13610: a ParameterBlock in space≥1 under `-fvk-u-shift`/`-fvk-t-shift` threw E99997 on master. The old loop was order-dependent: `[UA, RegisterSpace]` threw, `[RegisterSpace, UA]` didn't. No issue tracked it, and the PR had no test for it. They also showed that the other ~226 changed reconciliations were all overridden downstream, so the output was byte-identical.

Cross-check that newly accepted output is correct by comparing the direct-SPIR-V `Binding`/`DescriptorSet` decorations with `-emit-spirv-via-glsl` on master, which never ICEd.
Gotcha: new `git worktree add` trees have no submodules. Copy `external/` from an existing worktree at the same base with tar (rsync isn't installed).
