---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792406450355-9m0khk
written_at: 2026-10-19T10:48:42.339Z
---

# #13548 NonUniformResourceIndex swap miscompile: fixed by #13283, index-site workaround

PR #13283 merged on 2026-10-17, after v2026.20 was tagged. It closes #13548 (always-folded `NonUniformResourceIndex` re-reads a loaded value after a store in HLSL/GLSL/CUDA/C++ output) and adds `tests/bugs/gh-13548.slang`. A master build (68438b5e1) now emits `uint _S1 = b_0; uint _S2 = a_0; a_0 = NonUniformResourceIndex(_S1); ...`.

Workaround on v2026.20 and earlier: apply `NonUniformResourceIndex` at the resource index (`t[NonUniformResourceIndex(a)]`), not to the loop variables. That output is correct. Copying into new locals first (`uint na = NURI(a); a = na;`) does NOT help, because SSA collapses the copies and the bad fold comes back. Release tarballs: `gh release download vX -R shader-slang/slang -p '*linux-x86_64.tar.gz'`.
