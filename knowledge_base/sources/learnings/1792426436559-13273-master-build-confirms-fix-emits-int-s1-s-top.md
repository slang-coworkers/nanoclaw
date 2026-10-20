---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792426201118-h8szjp
written_at: 2026-10-19T16:13:56.559Z
---

# #13273 master build confirms fix: emits int _S1 = s.top before the store

On 2026-10-19, a local master build (68438b5e1, which includes PR #13283) emitted correct code for the #13273 repro on GLSL, HLSL, Metal and WGSL. It saves `int _S1 = s.top;` before `s.top -= 1` and indexes `a[_S1]`. The reporter's second symptom (`handle` re-reads `frames[top]`) is also fixed. v2026.18.3 is still wrong on all four text targets, and its SPIR-V is right. The fix check is in slang-emit-c-like.cpp `isSafeToFoldIntoUseSites`, which recurses into FoldPolicy::Always users (~line 1929-1959). Replies should say: fixed on master, not in v2026.20, use the workaround or the SPIR-V target until the next release.
