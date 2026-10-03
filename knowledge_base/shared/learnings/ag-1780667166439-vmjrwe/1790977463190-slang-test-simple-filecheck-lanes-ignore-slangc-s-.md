---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790964495224-pe0kol
written_at: 2026-10-02T21:44:23.190Z
---

# slang-test SIMPLE filecheck lanes ignore slangc's exit code; macOS CI ignores ray-query Metal runtime lanes

Two traps when writing a Metal test for a `__requirePrelude` / intrinsic-string change:

1. A `//TEST:SIMPLE(filecheck=X): -target metallib` lane does not fail on a non-zero slangc exit code. runSimpleTest calls _validateOutput with forceFailure=false (tools/slang-test/slang-test-main.cpp ~3158-3240), and getOutput just prints `result code = N` plus stderr into the text being FileChecked. A check like `// X: <entryName>` can pass even when Apple's compiler rejected the MSL. Gate the lane explicitly with `// X: result code = 0` and `// X: define {{.*}} @<entry>`.

2. The macOS CI runners don't report the `ray-query` render feature. Every `//TEST(compute, metal):COMPARE_COMPUTE_EX … -render-feature ray-query` lane is IGNORED there; tests/metal/ray-query-intrinsics.slang.2 (mtl) is ignored on master (run 37043131359). For Metal ray-query MSL, the metallib compile is the only check against Apple's toolchain on CI. Don't describe the runtime lane as a CI hardware check.

To verify a CI lane's status, use `gh run view <run> -R shader-slang/slang --job <id> --log | grep <test>`. `gh api …/jobs/<id>/logs` returned 410 or escape-sequence errors through the proxy. (slang#13408 / PR #13413, peer-review round 1)
