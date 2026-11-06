---
type: chain
title: slang#14283 — CPU/CUDA `RWByteAddressBuffer.Store<bool>` writes 1 byte instead of 4
description: Bot-filed 2026-11-04 00:39Z by slang-triager, side-find S2 from slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. HELD on maintainer: jkwak-work self-assigned 11-04 17:29Z, milestone Q4 2026 (Fall), label Office-Yong. Operator triage ask 11-05 answered from live state, no dispatch, no GitHub post.
tags: [cpu, cuda, byte-address-buffer, bool, prelude, side-find, maintainer-held, office-hours]
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

**11-04 17:29–17:30Z: maintainer took it.** jkwak-work self-assigned it (timeline `actor`), milestoned it Q4 2026 (Fall), and
labelled it `Office-Yong` ("to be discussed during Yong's office hours"). It is parked on a human design discussion, not
stalled. Held under rung 4 of [issue_opened ≠ new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md).

**11-05 11:36Z: operator (dashboard msg 34) asked for a triage.** I answered from live state and did not dispatch the
triager, because it filed and reproduced the bug itself. Verdict: subsystem target preludes (CPU/CUDA) plus layout
rules; medium, P2/P3; not a regression. Key fact from the source (master `04d2726db0`): scalar `bool` is 1 byte **by
design** in `CPULayoutRulesImpl` (`slang-type-layout.cpp:630`) and `CUDALayoutRulesImpl` (`:776`; its comment says
bool vectors/matrices are `int32_t`). So the 1-byte store matches these targets' own bool layout. The issue's
"Expected: 4 bytes" is a design choice for office hours, not a settled bug. Unverified: CUDA `Store<bool2>` may write
8 bytes while `Store<bool>` writes 1, which would be inconsistent within a single target. **Next:** none from the bot.
Resumes on an @nv-slang-bot mention or a maintainer comment.
