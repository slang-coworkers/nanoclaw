---
type: chain
title: slang#14311 — D3D nested-struct layout disagrees between StructuredBuffer, raw Load<T> and reflection
description: Human-filed (tdavidovicNV, MEMBER) 2026-11-04 17:32Z. jkwak-work assigned kaizhangNV (117 open assigned = routing, not a claim), RTR, milestone Q1 2027. Dispatched to slang-triager; fixer handoff criterion = self-contained bug, not a layout-policy change.
tags: [layout, hlsl, d3d, reflection, byte-address-buffer, structured-buffer]
---

# slang#14311 — D3D structured vs raw vs reflection layout

**Ask.** `struct Inner { uint64_t key; uint value; }; struct Outer { Inner item; uint tail; }`.
DXC lays out `StructuredBuffer<Outer>` with `tail` at 16 (stride 24). Slang's
`ByteAddressBuffer.Load<Outer>` lowering reads 12 (natural layout, nested size not rounded,
`slang-ir-byte-address-legalize.cpp::getOffset` → `getNaturalOffset`). D3D StructuredBuffer
parameter reflection also says 12 / stride 16, so a host filling by reflection gets garbage
(SlangPy D3D12 repro, 0xDEADBEEF). Direct DXC: 16/16. Two parts:
(A) reflection must describe the generated shader's layout — a bug independent of policy;
(B) raw vs structured interop — a contract question for maintainers.

**Live state at dispatch (11-04 ~17:40Z).** Open, 0 comments, body = payload, no linked PR.
Timeline: jkwak-work assigned kaizhangNV 17:32:42Z, labelled RTR, milestoned Q1 2027.
kaizhangNV has 117 open assigned issues ⇒ triage routing (the #14059 precedent), not ownership.
Stand-down trigger: kaizhangNV / jkwak-work / reporter says they will fix it, opens a PR, or asks
the bot to stop.

**Related chains (do not post on them from here).** #12714 + our draft #13300
([record](12714-layout-rules-version.md), parked on jkwak's GLSL pick; HLSL deliberately
unaffected). #12316 layout-policy duplication
([record](../imported/project_12316_type_layout_policy_duplication_techdebt.md), parked on
tangent-vector; its triage listed struct tail padding as an intentional divergence).

**Dispatch.** slang-triager, thread `gh-issue-shader-slang/slang-14311`, 11-04. Fixer handoff
allowed for (A) only if the fix is self-contained; if every principled fix changes user-visible
default D3D layout/reflection, frame it as a maintainer decision and report instead.

**11-04 17:56Z: triaged and parked for maintainers.** Triage comment cmt 6637980577. Checked:
author nv-slang-bot[bot], 0 @-mentions, disclaimer present; Type set to Bug at 17:56:11Z. The
triager reproduced on master 3da6f63c0e with the in-tree libdxcompiler (no D3D12 runtime, no FXC).
- (A) is real and D3D-only. Reflection says `tail`@12 / size 16; DXIL and direct DXC say 16 / 24.
  SPIR-V (std430, scalar, via GLSL) and CUDA reflection match their emitted code. Root cause:
  `HLSLStructuredBufferLayoutRulesImpl` (slang-type-layout.cpp:997-1008) inherits the non-rounding
  `DefaultLayoutRulesImpl::EndStructLayout`; its comment saying HLSL SBs don't round is wrong for
  DXC. Options: A1 round in the HLSL SB rules (triager's recommendation; FXC unverified), A2 A1 for
  DXC targets only, A3 pad the emitted HLSL (rejected), A4 opt-in via 202c.
- (B) is not D3D-only: `Load<Outer>(0).tail` reads byte 12 on every target by default, so on
  Vulkan std430, structured and raw access already disagree. Options B1–B4 (B4 ties it to #13300),
  no pick made.
- No fixer dispatch, per my criterion: every fix for (A) changes reflection or layout that users
  see. Triager one-shot **t-a3af10, 11-11 17:00Z** (in the triager's group; Main's `ncl tasks`
  can't see it). When (A) gets a pick, the triager sends the [Triage handoff] to slang-fixer.
  Memo: inbox `a2a-1793815076128-7jbahf/triage-14311.md`; triager's state is in its memory/issues/14311.md.

**11-11 17:01Z: re-check t-a3af10, no change.** I checked these on the timeline and events API:
- jkwak-work unassigned kaizhangNV and **self-assigned** at 11-04 18:14Z (events `assigner` = jkwak-work). They also added the `reflection` label. `RTR` is now `RTG`; `RTR` is gone from the repo, so it was probably renamed.
- On 11-05 the reporter cross-referenced the issue from draft slangpy#1266, which marks it as a strict xfail.
- No comments since our triage comment, and no PR. Nothing posted.
- The triager scheduled no further timer, so the chain is webhook-only. It is in `supervisor-state.json` as `awaiting_human`, and I added its disposition on 11-11.
- Reopen trigger: jkwak-work picks an option for (A) → [Triage handoff] to slang-fixer. If they say they will fix it, the bot stands down.
