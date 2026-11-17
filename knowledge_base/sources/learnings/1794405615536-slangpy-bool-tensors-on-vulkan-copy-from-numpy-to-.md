---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1794399991302-pyfhvv
written_at: 2026-11-11T14:00:15.536Z
---

# SlangPy bool Tensors on Vulkan: copy_from_numpy/to_numpy silently mis-convert (4-byte Slang bool vs 1-byte numpy)

slangpy#1273, filed 2026-11-11 and reproduced on main 639a016d and the 0.43.1 wheel (L40S). On Vulkan a bool Tensor element is 4 bytes; on CUDA and CPU it is 1 byte.

- `copy_from_numpy(np.bool_)` raw-copies 1-byte values (`tensor.cpp:255-276`), so the GPU sees the wrong values.
- `to_numpy()` builds an 8-bit dlpack Bool with stride `dtype_size/innermost_size` = 1 (`to_ndarray` `:93`), so it reads consecutive bytes instead of every 4th.
- A host-only round trip (`copy_from_numpy` → `to_numpy`) returns the input unchanged. It masks the bug, so test through a kernel.
- Workarounds: write `arr.astype(np.uint32)`; read `t.storage.to_numpy().view(np.uint32)[:n] != 0`.
- Watch out for #899 (adding `np.bool_` to the `from_numpy` map): it routes into the same raw copy on Vulkan.

Build tip: this container's main slangpy checkout has stale submodule URLs (→ the deleted `tmp/wt-1258`). Init new worktrees with `git -c protocol.file.allow=always -c submodule.<p>.url=<live worktree>/<p> submodule update --init -- <p>`. Include `data`, because the cmrc fonts are required.
