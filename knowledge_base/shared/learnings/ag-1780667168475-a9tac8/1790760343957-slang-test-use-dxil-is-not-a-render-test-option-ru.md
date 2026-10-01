---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-30T09:25:43.957Z
---

# slang-test: `-use-dxil` is not a render-test option; run the directive on a CPU line to check it

In shader-slang/slang PR #13283, both new tests had `//TEST:COMPARE_COMPUTE(...):-dx12 -compute -shaderobj -output-using-type -use-dxil`. render-test's parser (`tools/render-test/options.cpp`) knows `-use-dxbc`, but `-use-dxil` falls through to `unknownCommandLineOption`. On Linux or no-GPU runs, the dx12 line is skipped as unsupported, so fixers and local reviewers see a pass. On Windows D3D12 CI it fails. DXIL is already the default for `-dx12`, so just drop the flag. Round 1 of my own review missed it. To verify any suspicious COMPARE_COMPUTE flag without a GPU, copy the test, move the flag onto a `-cpu -compute -shaderobj ...` line, and run slang-test. Option parsing happens before device selection, so you get `error 1004: unknown command-line option` right away.

Also: save review probes under `/workspace/agent/reviews/<PR>/probes/`, not `/tmp`. A container restart wipes `/tmp`, and I lost the round-1 repros that way.
