---
type: chain
title: slang#14282 — HLSL `RasterizerOrderedByteAddressBuffer.Load<T>` emitted as `.Load<T >`, DXC rejects
description: Bot-filed 2026-11-04 00:39Z by slang-triager, side-find S1 from slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. HELD ON MAINTAINER — jkwak-work self-assigned 11-04 17:31Z + Q1 2027 milestone; 11-09 recheck closed as no-dispatch, no further timer.
tags: [hlsl, byte-address-buffer, rov, emit-c-like, side-find, held-on-maintainer]
---

# slang#14282 — ROV byte-address `Load<T>` → `.Load<T >(` → DXC "Explicit template arguments on intrinsic Load are not supported"

**Bug.** `rov.Load<float>(0)` on a `RasterizerOrderedByteAddressBuffer` emits `(rov_0).Load<float >(0U)` for
HLSL SM 6.x; DXC 1.9 rejects it (ROV BAB has no templated `Load`). `RWByteAddressBuffer.Load<float>`,
`asfloat(rov.Load(0))` and `rov.Store<float>` (emitted untyped) compile. Loud compile error with a workaround.
Cause per the issue body: the generic `kIROp_ByteAddressBufferLoad` emit in `slang-emit-c-like.cpp:3121` emits
`.Load<T >(` for every buffer type; the HLSL override handles only `uint`/`uintN`; and
`slang-ir-byte-address-legalize.cpp` splits into `uint` loads + bit cast only when `useBitCastFromUInt` is set
(`slang-emit.cpp:2298-2312`, DX profiles ≤ 5.0 only, not for ROV). Reproduced by the triager on master `f1cd35ff8`.

**Origin.** Same as [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md): slang-reviewer R1 on
[#14259](14259-hlsl-byte-address-store-double-untyped.md)'s PR #14276 → fixer → slang-triager
(sess-1793741880740-mvymkh), which deduped, reproduced and filed both. Kept out of #14276's scope by instruction.

**GitHub (11-04 00:41Z).** Open, label `reproduced`, 0 comments, no assignee. The issue body is the resumable artifact.

**Decision (11-04 00:42Z, Main session sess-1793752763678-y82qfn): no dispatch.** Chain-owned follow-up; fixer
chain held filed-only (8 slang-fixer sessions running; lower severity). It touches the same byte-address emit code
as #14276, so a fixer starts after #14276 merges to avoid a conflicting parallel edit. One-shot
`recheck-14282-pr14276-51f9` (11-09 12:00Z) dispatches slang-fixer if #14276 has merged.
**Resumes earlier on:** a human comment, a maintainer `bot-ok`/assignment, or an operator go-ahead.

**11-05 09:52Z (from the #14259 session).** skiminki-nv chose #14322 (HLSL `L` suffix) first. #14276 stays a draft, and its fate depends on an
open typed-literal question ("should also eliminate the need for #14276"). So "#14276 merges" may never happen. The 11-09 recheck should treat
"#14276 still draft, superseded/undecided" like case (d) and ask the operator whether #14282 gets its own fixer, rather than re-arm forever.

**11-09 12:00Z recheck (`recheck-14282-pr14276-51f9`): case (a), held on maintainer, no dispatch.** The live issue events show
`assigned` to jkwak-work by jkwak-work at **11-04 17:31:14Z** (self-assign, two minutes after the same maintainer took
[#14283](14283-cpu-cuda-bab-store-bool-one-byte.md)) and milestone **Q1 2027 (Winter)** at 17:31:24Z. Still open, `reproduced`, 0 comments.
The 11-04 record missed this because the assignment came 17 h after filing. That makes it a rung-4 maintainer hold whatever
#14276 does (still an OPEN draft, `BEHIND`, head `860cc750`, last updated 11-06; its fate is tied to #14416). So there is no operator
ask and no fixer. No further timer either: webhooks deliver a comment, an unassign, `bot-ok` or a close. **Resumes on:** jkwak-work
unassigning, or asking the bot, or `bot-ok`.
