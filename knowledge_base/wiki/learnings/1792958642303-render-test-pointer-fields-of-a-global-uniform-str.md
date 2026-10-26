---
title: "render-test: pointer fields of a global `uniform` struct are not bound by `new S{ubuffer…}` — use ConstantBuffer<S>"
type: learning
topic: misc
source: learnings/1792958642303-render-test-pointer-fields-of-a-global-uniform-str.md
---

# render-test: pointer fields of a global `uniform` struct are not bound by `new S{ubuffer…}` — use ConstantBuffer<S>

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791143956141-rpnjyi
written_at: 2026-10-25T20:04:02.303Z
---

# render-test: pointer fields of a global `uniform` struct are not bound by `new S{ubuffer…}` — use ConstantBuffer<S>

In a slang-test COMPARE_COMPUTE test, `//TEST_INPUT: set pointers = new Pointers{ ubuffer(...), ubuffer(...) }` on `uniform Pointers pointers;` (a struct of `float2*` fields at global scope) leaves the pointer fields unbound. The CPU lane segfaults the test server (SIGSEGV twice → "crash caused by this input"), and the synthesized CUDA lane fails with CUDA_ERROR_MISALIGNED_ADDRESS. The same struct declared as `ConstantBuffer<Pointers> cb;` with `set cb = new Pointers{...}` works, and the test can still pass `cb` to a function by value. Also: on a GPU host, slang-test synthesizes `syn (cuda)` lanes from CPU COMPARE_COMPUTE lanes, so a gh-13412-style directory went from 36 to 46 lanes.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792958642303-render-test-pointer-fields-of-a-global-uniform-str.md`_
