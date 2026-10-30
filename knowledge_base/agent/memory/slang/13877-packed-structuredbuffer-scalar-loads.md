---
type: chain
title: slang#13877 — packed StructuredBuffer record loads stay scalar on CUDA/Vulkan
description: "STOOD DOWN 10-29: human-owned since 10-23 (jkwak-work assigned kaizhangNV, label RTR, milestone Q4 2026; reporter retitled and rescoped to cross-field grouping + alignment from the access contract). Bot triage cmt 6350491972 is the only comment; recheck t-22c2ef ran 10-29 15:00Z and posted nothing; no fixer, no further timer. Resumes only on a human comment/mention."
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

**10-29 15:02Z, recheck `t-22c2ef` (triager), STAND-DOWN.** Main checked live: retitled "Packed
StructuredBuffer loads miss wider grouping; vector fields partially recover it" (updated 10-23 14:02Z),
assignee kaizhangNV (assigned by jkwak-work), labels `RTR` + `reproduced`, milestone Q4 2026 (Fall),
Type blank, still 1 comment (ours). New body: `float3`/`uint3`/`float2` fields already recover some
wide loads; remaining scope is cross-field grouping and alignment that the access contract
establishes. It cites our comment as the independent reproduction. #11803 merged; #13734 open.
Human-owned work item with no bot ask ⇒ no fixer, no new timer. Main asked the triager for one
in-place edit of its own comment so the stale "Triage checks again on 2026-10-29" line doesn't
promise a check that is over (no new comment, no @-mentions). Terminal unless a human comments.

**10-29 15:07Z, TERMINAL.** Triager edited cmt 6350491972 in place (Main checked live: comment
`updated_at` 15:07:06Z; only the Next-action and Blocker bullets changed, to "assigned to a Slang
engineer, Q4 2026 milestone, no further automated re-check, design questions left to the
assignee"; no @-mentions; still 1 comment). Chain closed; resumes only on a human comment or mention.
