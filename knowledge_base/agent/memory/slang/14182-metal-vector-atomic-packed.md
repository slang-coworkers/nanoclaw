---
type: chain
title: slang#14182 — Metal: atomics on a vector destination emit `atomic_packed_*` types MSL does not have
description: BOT-filed by slang-fixer 2026-11-02 12:39:40Z as a side finding of the #14153 work (filing policy, no go-ahead needed). Low priority (reach is only the __atomic_* intrinsics). FILED-ONLY, fan-out held. The issue_opened webhook needs NO dispatch.
tags: [metal, emit, atomics, vector, bot-filed, filed-only, low-priority]
---

# slang#14182 — Metal vector atomics emit `atomic_packed_*`

**Origin.** slang-reviewer saw it during the patch review of the abandoned #14153 bot branch. slang-fixer
`sess-1793614762821-zcmuu7` (thread `gh-issue-shader-slang/slang-14153`) reproduced it and filed it at my direction
(msg 97). Its report is msg 94, 12:40Z. I checked live at 12:41Z: author `app/nv-slang-bot`, no labels, no
#14153/#14170 reference, no @-mentions, no Fixes link. That is R6-clean for [#14153](14153-metal-float-texture-atomic-add.md).

**Finding (the fixer's).** Reproduced on 6815ed82d (Debug). `__atomic_reduce_add` on `float2`/`half2` and `__atomic_exchange`
on `float2` exit 0 and emit `atomic_packed_*`, and so does `uint2` (codex found this; the fixer confirmed it). The issue asks for E55204 on
any vector destination. MSL §2.6 has no vector atomics. Cause: there is no vector check, and `isFloatingType` (`slang-ir.cpp:8722`) is
scalar-only. **Reach:**
- Generic `InterlockedAdd` rejects vectors with E39999.
- `Atomic<T>` accepts only scalars.
- `InterlockedAddF16Emulated` gives E36107 on Metal.
- The neural module uses vector atomics only on CUDA.
So the only known path is calling the `__atomic_*` intrinsics directly. Low priority. Deduped: 0 hits for `atomic_packed`.

**State: filed-only, fan-out held (my call 12:41Z).** No fixer chain. The `issue_opened` webhook needs no dispatch;
sibling Main session `sess-1793623182904-6j1kqo` was handling it at 12:40Z.

**Webhook check (2026-11-02).** The `issue_opened` webhook reached a Main session. I did not dispatch it. `ncl sessions list` shows only the
sibling Main session `sess-1793623182904-6j1kqo` on `gh-issue-shader-slang/slang-14182`. No triager or fixer session exists.
