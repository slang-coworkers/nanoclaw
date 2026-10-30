---
type: chain
title: slang#14032 — struct alignment control (`[Align(N)]` / alignas) for pointer/CUDA/Metal layouts
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:14Z, cloth-sim batch. Triaged feature/medium/P2 (supersets #5873). PARKED for csyonghe design direction; R6 hold to 2026-11-02 17:10Z, re-check t-87db0a 11-02 17:15Z. Adjacent CUDA pointee-layout bug authorized for filing 10-29.
tags: [layout, cuda, metal, reflection, feature-request, r6]
---

# slang#14032 — struct alignment control

**Ask.** A type-level (and per-field) alignment attribute that every C-like target honours:
CUDA `__align__`/`alignas`, Metal and C++ `alignas`, raised alignment in scalar/std430 layout rules
(`Offset`/`ArrayStride`), and reflection that reports it. The reporter measured the codegen cost on
sm_89: the Slang port gets scalar `LDG.E`/`STG.E` where the C++ original gets `.64`/`.128`. Enclosing-struct
offsets also differ from host C++ (8 vs 4, 16 vs 4).

**Related prior work (mine).** `IRTypeAlignmentAttr` (stable name 901) merged in #12306 — see
[../project_11135_ir_type_alignment_attr_12306.md](../project_11135_ir_type_alignment_attr_12306.md);
tech-debt issue #12316 tracks front-end `TypeLayout` vs IR natural-layout duplication. Passed to the
triager as context only; whether either applies is the triager's finding.

**R6.** No `bot-ok` label, no crash word → hold: no bot comment before **2026-11-02 17:10Z**. Stated in the dispatch.

**Owner.** slang-triager, thread `gh-issue-shader-slang/slang-14032`. Dispatched 10-29.

## Triage (slang-triager, 10-29 17:25Z, master 9b3ac252d). The triager's findings; I checked only the GitHub state.

- feature-request / medium / P2. Supersets **#5873** (Backlog, OPEN), where csyonghe proposed `[Align(x)]` on struct types in 2024-12.
- No user alignment control exists today: `[Align(16)]` → `warning E31000 unknown attribute`. Repro reproduced on the L40S.
- `IRTypeAlignmentAttr` is an operand of `IRTypeLayout`, not of the type, and no codegen pass reads it, so it cannot carry a user alignment.
  A user alignment has to reach three engines: front-end TypeLayout, AST natural layout (`sizeof`/`alignof` folding), and IR layout (#12316 duplication).
- Recommended (A): type-level `[Align(N)]` with one new IR struct decoration that all three engines honour, plus C-like emit overrides; per-field in a follow-up (B).
- Six design decisions are for csyonghe (in the memo). Not handed to the fixer.

**GitHub (verified 10-29):** 0 comments, no labels, Issue Type = Feature (set by the triager). Memo: `/workspace/inbox/a2a-1793294735871-1d0o43/triage-14032.md`.

**Timer:** triager one-shot **t-87db0a** at 2026-11-02 17:15Z. It reads the timeline and #5873, then hands off, validates a reporter PR, or posts the parked 5-bullet.

## Adjacent bug: CUDA pointee layout vs native `float4`. Authorized for filing 10-29.

These are the triager's GPU measurements: for `struct{float a; float4 c;}` through `T*`, Slang gives sizeof 20, align 4, `c`@4; nvcc gives 32/16, `c`@16, and the device stride is 32.
There is no duplicate; #12714 is the docs/default-layout policy issue.
I authorized the triager to file it, using the precedent "filing a verified issue is not an operator gate" ([14007](14007-metal-parameterblock-combined-sampler-texture-only-ops.md)).
The condition is **no `#14032` reference in it while R6 holds** (a cross-reference puts an event on the held issue's timeline). t-87db0a adds the link after 11-02.
Its `issue_opened` webhook belongs to this chain, so it is not a new dispatch.

**Filed 10-29 17:4xZ: #14040** (by nv-slang-bot; I checked the state). Title: "CUDA: `sizeof`, `alignof` and `T*` pointee reflection disagree with nvcc for structs with `float2`/`float4` fields".
It is labeled `reproduced`, has Issue Type Bug and 0 comments, and its body does not mention 14032. The triager's report: OUTPUT_REVIEW approve, and t-87db0a updated so it also adds the
#14032 ↔ #14040 link on 11-02. Parked for maintainer direction; no fixer yet. **R9 gap:** the `bot` label returns 404 on shader-slang/slang, so it was not applied
(same class as the missing `no-bot`/`bot-ok` labels in [../imported/project_13591_ai_contributor_standards_batch.md](../imported/project_13591_ai_contributor_standards_batch.md)). Flagged to the operator 10-29.

**10-29 ~21:5xZ reporter comment 6509185941** on #14032 (not an @nv-slang-bot mention). It gives runtime numbers: on sm_89 the Slang port is +51 % at 32k springs and +13 % at 131k,
and a CUDA-only `float2*` store workaround recovers the 64-bit stores. **The reporter linked #14040 themselves**, so t-87db0a's link step is moot. I relayed it verbatim to the triager
(in_reply_to its msg 14). R6 still holds: the comment adds data and asks the bot nothing.

**10-29 21:53Z: the reporter commented on #14040** (cmt 6509186510, no bot mention). Metal `S_natural_0` uses `packed_float2` (`b`@4, stride 12), and SPIR-V gives Offset 4 / ArrayStride 12. CUDA uses native `float2` (`b`@8, sizeof 16). Their ask is the same `T*` pointee layout on CUDA and Metal, or a diagnostic for cross-target layout differences. The #14040 webhook session relayed it verbatim to the triager's owning session `sess-1793293942921-jhfet7` (pin + `in_reply_to`=own webhook row; landed as seq 34). The reply is the triager's call; no `#14032` reference on #14040 before 11-02 17:10Z. The sibling #14032 comment (6509185941, runtime numbers + `float2*` workaround) was relayed by the #14032 Main session at 21:53:54Z.
- 22:21Z the triager run failed ("agent run failed"). Cost state was ok ($10.75/$60), and GitHub was unchanged. Two inbounds were unhandled: my #14032 relay and a sibling Main's 21:54Z #14040 relay of comment 6509186510.
  22:2xZ I re-sent a nudge pinned to `sess-1793293942921-jhfet7`, the triager's owner session.
- 22:26Z the triager resumed and reported both items handled. **I checked GitHub:** #14040 has a bot reply, comment 6509779709. It lists three options for the maintainer: scalar layout on CUDA, CUDA vector alignment, and a diagnostic. It does not mention 14032.
  #14032 still has only the reporter's comment. The memo now includes the runtime data and a check of the workaround on the L40S (3× `STG.E.64`). t-87db0a is still 11-02 17:15Z, without the link step, and will post a fresh comment.
  **State:** parked on maintainer direction for both #14032 (6 decisions) and #14040 (direction 1/2/3). Nothing is due from Main until a webhook arrives or t-87db0a reports.
