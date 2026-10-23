---
type: chain
title: slang#13877 — packed StructuredBuffer record loads stay scalar on CUDA/Vulkan
description: "MEMBER-filed (tdavidovicNV) 10-22 19:59Z perf/codegen report: fully consumed packed scalar-array records load as 8x32/6x32 on CUDA+Vulkan vs 2x128/3x64 via a vector view. Companion #13878 (aligned immutable handle loads) is owned by a sibling Main session. TRIAGED + PARKED ON MAINTAINER 10-22 20:23Z (cmt 6350491972, label reproduced, Type blank): enhancement/low/P2; design questions = base-alignment contract, placement A/B/C, scope. Triager one-shot recheck t-22c2ef 10-29 15:00Z."
tags: [slang, structuredbuffer, load-widening, cuda, spirv, performance]
resource: https://github.com/shader-slang/slang/issues/13877
---

# slang#13877

**2026-10-22 19:59Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, no
assignees, created ≈ updated, body = payload (plus a trailing "Companion report: #13878" line).
Author tdavidovicNV (MEMBER, same reporter as #13858/#13276). No self-assignment, no
maintainer-owned plan or PR, so it is a report, not a held work item. Only sessions on the
canonical thread: this Main webhook session (`nwgahs`). R6 gate nanoclaw#1993 still draft, so
routing is unchanged.

**What it reports.** `StructuredBuffer<PackedTriangleVertex>` (32 B: `float[3]`, `uint[3]`,
`float[2]`) and `PackedLSSVertex` (24 B) load as per-scalar accesses on CUDA and Vulkan; viewing
the same bytes as `uint4` records and `bit_cast`-ing back gives 2x128 / 3x64 native loads. D3D12
DXIL is scalar too, but the driver recombines it. Asks for legal wider grouping from known
layout/alignment without changing strides, padding LSS, or forcing full-record reads.

**Related chains (context only):** human PR #13734 (#13732, partial-member load in
`slang-ir-lower-buffer-element-type.cpp`) touches the same "unused-field elimination" constraint;
our #11545 byte-address chunker series ([3/3] #11803, awaiting merge) is the design context the
body cites; #13126/#13805 are ByteAddressBuffer alignment chains.

**Routing (Main, 10-22):** dispatched to slang-triager on `gh-issue-shader-slang/slang-13877`.

**10-22 20:23Z, TRIAGED** (slang-triager session `vrxrvb`; Main checked live: comment
[6350491972](https://github.com/shader-slang/slang/issues/13877#issuecomment-6350491972), label
`reproduced`, Type blank, no assignee). Memo archived at `/workspace/agent/reports/triage/triage-13877.md`.
- Reproduced at master `9dbd07227`. Enhancement / low / P2, not a duplicate (#3533/#4036 closed).
- Scalarization points: `deferBufferLoad` (`slang-ir-defer-buffer-load.cpp:391`) splits the struct load
  per member; SPIR-V `createArrayUnpackFunc` (`slang-ir-lower-buffer-element-type.cpp:527`) unpacks per
  element; CUDA `createLoadFuncForType` (`slang-ir-cuda-immutable-load.cpp:107`) emits one `__ldg` per element.
- CUDA probe on L40S: alignment hints alone don't widen `__ldg`; only an emitted `__ldg((const uint4*)p)`
  gives `LDG.E.128.CONSTANT`. Vulkan native code not re-measured.
- Questions posted for a maintainer: (1) base-alignment contract (overlaps #13878), (2) placement A/B/C,
  (3) scope. Triager lean, kept off GitHub: B, after human PR #13734 lands (same narrowing code).
- Type left blank: the repo's `Performance` Type fits but is outside triager policy. A human may set it.
- Timer: triager one-shot task `t-22c2ef` (session `h9s6jx`), 2026-10-29 15:00Z. No fixer handoff, no bot-PR promise.
- Resumes on a maintainer/reporter reply (webhook) or the 10-29 recheck.
