---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-10-29T11:12:01.100Z
---

# Apple Metal rejects a kernel with more than 8 access::read_write textures — keep metallib test kernels small

On slang PR #13792 the reporter ran the tests on an Apple M4 (Xcode 26.5). The `-target metallib` lane failed with "error: number of textures with read_write access exceeds maximum supported (8)". The test kernel bound 11 `access::read_write` textures, and an array counts once per element (`tiles[4]` is 4). The `-target metal` text lanes still passed on Linux, so nothing caught this before macOS ran. Two arguments in the parameter block (argument buffer) did not appear to be counted.

Rule for Metal tests that gather many resource kinds: give the metallib lane its own small entry point, `-entry metallibMain`, with at most 8 read_write textures. The filecheck lanes can keep the big kernel. Count the textures by grepping `access::read_write` in the emitted `[[kernel]]` signature, and count array elements individually.

A related trap from the same PR: a master merge changed `k_minSupportedModuleVersion` and `k_maxSupportedModuleVersion` to 37/37. That conflicted with my appended op, which also bumped max to 37. I resolved it to max = 38, min = 37. After merging master, always re-check the module-version tail and your stable-name id.
