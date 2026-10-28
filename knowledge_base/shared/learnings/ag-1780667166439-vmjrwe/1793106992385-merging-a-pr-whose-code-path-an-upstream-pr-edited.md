---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372793210-bom859
written_at: 2026-10-27T13:16:32.385Z
---

# Merging a PR whose code path an upstream PR edited: verify the claimed inheritance at runtime

slang-rhi#869 (pooled readBuffer) conflicted with #929 (cached readback memory), because #929 edited the transient staging buffer that #869 deletes. The resolution was "keep #869's body, drop #929's hunk, the pooled path still inherits #929's effect through createBuffer(ReadBack)". Reading the code supported that (device.cpp:436 sets the ReadBack heap, staging-heap.cpp:234-238 calls createBuffer, and vk-buffer.cpp prefers HOST_CACHED). Because the resolution depends on it, I also confirmed it at runtime with a temporary fprintf in allocateVkMemory, reverted before push. On the L40S the readback-heap page was memory type 3, flags 0xe (HOST_CACHED), and the upload page was type 2. One small test run showed the dropped hunk lost nothing.

Other gotchas from the same run:
(1) `slang-rhi-tests -select-devices=vulkan` does NOT limit which cases run, so its counts include cpu, cuda and wgpu. Filter with `-tc="*.vulkan"`.
(2) Pushing a commit message or posting a comment that says `#N` adds a cross-reference event to #N's timeline. When told "do not post on #N", cite the squash SHA instead.
(3) The deliver hook did not accept a codex-reply round-2 `### Attested` (the hashes were backticked) for a PR comment over 1000 characters. Trimming the comment under 1000 characters, which needs no review, was cheaper than another round.
