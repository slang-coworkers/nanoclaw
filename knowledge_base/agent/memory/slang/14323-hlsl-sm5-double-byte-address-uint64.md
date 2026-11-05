---
type: chain
title: slang#14323 — HLSL SM 5.0 (FXC) `double` byte-address Load/Store emits uint64 types and templated calls
description: Bot-filed 2026-11-04 21:40Z by slang-triager, side-find S3 from slang-reviewer's R1 on PR #14322 (#14259 chain). Bug + `reproduced`. FILED-ONLY until the #14259 approach (#14276 vs #14322) lands; one-shot recheck-14323-after-1425-4d9c (11-11 13:00Z).
tags: [hlsl, fxc, sm5, byte-address-buffer, double, byte-address-legalize, side-find, filed-only]
---

# slang#14323 — SM 5.0 `double` byte-address forms are all invalid for FXC

**Bug.** With `-target hlsl -profile cs_5_0`, a constant `Store<double>` emits `Store(0U,4631107791820423168ULL)`,
a runtime value gets a `(uint64_t)` cast, `Store<double2>` passes through untyped, and `Load<double>` becomes
`Load<uint64_t >`. SM 5.0 has no 64-bit ints and FXC has no templated `Load<T>`/`Store<T>`. Cause per the issue:
`getSameSizeUIntBaseType` (slang-ir-byte-address-legalize.cpp:1305-1349) maps 8-byte scalars to `UInt64` instead of
splitting into two `uint` words (the Metal/WGSL `minimumStoreScalarSize` path already splits); `useBitCastFromUInt`
is set only for DX ≤ 5.0 (slang-emit.cpp:2298-2312). Evidence is emitted HLSL only (FXC is Windows-only).
Pre-existing on master 3da6f63c0; not a regression.

**Origin.** slang-reviewer R1 on [#14259](14259-hlsl-byte-address-store-double-untyped.md)'s alt PR #14322 → triager
owner session sess-1793741880740-mvymkh, which deduped, reproduced, filed it (its seq 33/35) and left routing to Main.
Kept out of #14322/#14276 scope by instruction.

**GitHub (11-04 21:42Z).** Open, label `reproduced`, 0 comments, no assignee. The issue body is the resumable artifact.

**Decision (11-04 21:42Z, Main session sess-1793828426010-kfytek, the issue_opened owner): no dispatch.**
Same code region (byte-address legalize + HLSL byte-address emit) as both open #14259 drafts, whose tests already
conflict; #14276 changes this very SM 5.0 output to `Store<uint64_t >`. A third parallel PR would collide, and the
right shape depends on which #14259 approach skiminki-nv picks. Same pattern as [#14282](14282-hlsl-rov-bab-templated-load-dxc-reject.md).
One-shot `recheck-14323-after-1425-4d9c` (11-11 13:00Z) dispatches slang-fixer once a #14259 PR has merged.
**Resumes earlier on:** a human comment, a maintainer `bot-ok`/assignment, or an operator go-ahead.
