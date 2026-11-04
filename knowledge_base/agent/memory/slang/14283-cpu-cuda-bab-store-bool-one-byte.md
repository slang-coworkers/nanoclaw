---
type: chain
title: slang#14283 — CPU/CUDA `RWByteAddressBuffer.Store<bool>` writes 1 byte instead of 4
description: Bot-filed 2026-11-04 00:39Z by slang-triager, side-find S2 from slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. FILED-ONLY, no fixer (fixer at 8 running sessions); issue_opened webhook needed no dispatch.
tags: [cpu, cuda, byte-address-buffer, bool, prelude, side-find, filed-only]
---

# slang#14283 — CPU/CUDA `Store<bool>` writes `sizeof(bool)` = 1 byte

**Bug.** On CPU and CUDA, `RWByteAddressBuffer.Store<bool>(0, true)` writes 1 byte, so the word reads
`AAAAAA01` over a `0xAAAAAAAA` fill. Vulkan and DXIL write 4 bytes (`1`). Cause: the preludes copy
`sizeof(T)` bytes (`prelude/slang-cpp-types.h:225-230`, `prelude/slang-cuda-prelude.h:3339-3344`).
`Load<bool>` (`slang-cuda-prelude.h:2986`, `:3301`) and bool vectors are probably affected but were not tested.
Reproduced by the triager on master `f1cd35ff8` (L40S for CUDA/VK). Not a regression claim.

**Origin.** slang-reviewer R1 on [#14259](14259-hlsl-byte-address-store-double-untyped.md)'s PR #14276 found
two pre-existing side-finds and relayed them through the fixer to slang-triager (session
sess-1793741880740-mvymkh), which deduped, reproduced and filed S1 = #14282 (HLSL ROV `Load<T>` DXC reject)
and S2 = #14283. Out of #14276's scope by instruction. Related: #14157 (Metal/WGSL bool BAB bit-cast; reporter PR #14167).

**GitHub (11-04 ~00:45Z).** Open, Type=Bug, label `reproduced`, 0 comments, no assignee. The issue body is the
resumable artifact.

**Decision (11-04, Main): no dispatch.** The issue_opened webhook is a chain-owned follow-up. A fixer chain
is held, filed-only (policy: hold lower-severity filings when the fixer is loaded; 8 slang-fixer sessions running).
Open design point for whoever picks it up: Slang's CPU/CUDA layout size for `bool` in buffers, and whether
`Store<bool>` should widen to 4 bytes or that is a layout decision. **Resumes on:** a human comment, a maintainer
`bot-ok`/assignment, or an operator go-ahead for a fixer.
