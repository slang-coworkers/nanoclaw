---
type: chain
title: slang#14259 — HLSL constant double RWByteAddressBuffer.Store emits untyped `.Store(` → DXC f32 store
description: Human-filed (tdavidovicNV) 2026-11-03. CLOSED fixed 2026-11-11 by skiminki-nv via bot PRs #14322 (L suffix) + #14416 (strongly-typed HLSL literals); #14385 closed superseded. Remaining tracked in #14458 (draft #14276 retargeted) and #14456; re-check recheck-14259-review-sta-a089 11-25.
tags: [hlsl, byte-address-buffer, double, emit-c-like]
---

# slang#14259 — constant `double` `RWByteAddressBuffer.Store<double>` → untyped HLSL `.Store(0U,42.0)`

**Ask.** `output.Store<double>(0, double(42.0))` emitted `.Store(0U,42.0)` with no template arg. DXC infers `float` and lowers it to
`dx.op.rawBufferStore.f32`, which writes 4 bytes. The reporter pointed at the `kIROp_ByteAddressBufferStore` case in
`slang-emit-c-like.cpp` (Load keeps its type, Store doesn't). Runtime doubles, `RWStructuredBuffer<double>` and int64 constants are fine.
Reported on v2026.20.

Dated history (triage, the maintainer redirects, the FXC runs, relays, corrections): [[slang/14259-hlsl-byte-address-store-history.md]].
New dated entries go there, not here.

## Current state (2026-11-11 13:13Z)

- **Reported case FIXED on master c66100b1e** (fresh Release build): `.Store(0U,42.0L)`, which DXC compiles to `rawBufferStore.f64`.
  Confirmation posted as cmt 6796775607. The issue stays open until skiminki-nv closes it.
- **Owners:** triager owner session sess-1793741880740-mvymkh (the fixer's parent; keeps the sentinel until #14276 resolves);
  fixer sess-1793742971321-k0j5bx. Relay maintainer asks to the triager session, verbatim, with `<github-post-authorized />` when the
  comment mentions the bot.
- **Assignee / decider:** skiminki-nv (repo admin).
- **Timer:** one-shot `recheck-14259-review-sta-a089` (11-16 12:00Z); its case (b) covers the post-merge state.
- **Next:** skiminki-nv closes #14259. #14276 waits for direction under #14458. A new fixer chain for the #14458 test work needs a
  maintainer ask or the operator, not a reflex dispatch.

| PR | approach | state | notes |
|----|----------|-------|-------|
| #14276 | type the HLSL `Store<T>` call; also fix C++/CUDA widths | DRAFT @ 860cc7501 | Body now "Part of #14458". Its C++/CUDA width fix (double inf written as 4 B, float NaN as 8 B) is covered by no other PR. |
| #14322 | `L` suffix on finite HLSL double literals | **MERGED 11-05** 4a6758601 | Fixed the repro. |
| #14385 | casts for half literals and NaN/±Inf | **CLOSED 11-11** | Superseded by #14416. |
| #14416 | strongly-typed HLSL scalar literals (suffix or `int16_t(..)` cast) | **MERGED 11-11** c66100b1e | int zero is `int(0)` because DXC types `0L` as uint. SM 6.6 dx12 end-to-end green; SM 5.1 FXC rows skipped with maintainer approval (see #14456). |

## Follow-up issues (owned by this chain; their `issue_opened` needs NO dispatch)

| issue | scope | state |
|-------|-------|-------|
| #14456 | SM 5.1 FXC skips in #14416's test: the -0.0 rows, DBL_MAX, the double NaN words 21–22 | §1 only. skiminki-nv removed §2 (docs/generated regen) on 11-11: the maintainers' next generation cycle handles those 55 lanes, so **no bot issue or action for them**. |
| #14458 | test RWByteAddressBuffer loads/stores on all backends and fix what the tests find | Filed 11-11 13:05Z, no assignee. Starting points: #14276 widths, #14283, #14157, #14282, #14323; related #14456, #14386. |

## Side finds (all filed-only; sibling Main sessions own dispatch, this session dispatches nothing)

| issue | what | disposition |
|-------|------|-------------|
| [#14282](14282-hlsl-rov-bab-templated-load-dxc-reject.md) | ROV `Load<T>` emitted templated, DXC rejects | held: jkwak-work self-assigned + Q1 2027 milestone |
| [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md) | CPU/CUDA `Store<bool>` writes 1 byte | resumes on a human signal; listed in #14458 |
| [#14323](14323-hlsl-sm5-double-byte-address-uint64.md) | FXC SM 5.x double byte-address → uint64 / templated | held: jkwak-work self-assigned |
| [#14386](14386-floattohalf-half-nan-signaling.md) | `FloatToHalf` narrows NaN to a signaling NaN | `recheck-14386-floattohal-2ff9` (11-13). Related: [[imported/project_13857_llvm_constant_float_quiets_signaling_nan.md]] |

Related elsewhere: #14161 (half inf/NaN, jkwak-work) and human PR #13927 (needs a rebase on its own).
Not filed (triager hypothesis, unverified): vk arithmetic may lose inf/NaN/-0.0 unless SPIR-V `SignedZeroInfNanPreserve` is set.

## Lessons

- A `pr_mention` webhook body has its leading `@nv-slang-bot:` stripped. Read the GitHub comment before relaying without the marker
  ([[feedback_pr_mention_body_strips_leading_mention.md]]); on 11-09 a brief went out without it and had to be re-sent.
- The vk lanes do not stand in for a DXC/DXIL end-to-end check. dx12 and FXC run only on Windows CI, so say "pending on Windows CI" on GitHub.
- When a maintainer redirects the approach, open a separate draft and leave the earlier PRs untouched until they choose.
- A test row that fails on a downstream compiler is reported as a finding with a keep/remove question; it is removed only with the
  maintainer's OK, never "by analogy" with an earlier approved removal.
- A run that shows `waiting` may have finished every test job and be held only by `falcor-build-approval-gate`. Read the jobs before
  relaying "CI never ran" (wrong relay 11-11 08:20Z).
- A follow-up a maintainer asks the bot to file belongs to the chain that filed it; its `issue_opened` needs no new triager or fixer.
- 11-11 18:09Z **#14259 CLOSED as COMPLETED** by skiminki-nv (cmt 6803594110, no mention): "Let's follow up the remaining items in issues #14458 and #14456".
  - Read as where the remaining work is tracked, not a go-ahead, so no new fixer work and no bot post. I notified the triager (in_reply_to=270).
  - Still open, owned by this chain: draft #14276 (retargeted to #14458, waiting for direction), #14458, #14456.
  - Timer: `recheck-14259-review-sta-a089`, re-pointed to 11-25 at #14276/#14458/#14456.
    It survives task-hygiene because its targets are open.
- 11-11 18:12Z triager [Resolution]: closed fixed. The triager released its triage sentinel; the fixer keeps its sentinel for #14276 only. Chain terminal, apart from the #14276/#14458/#14456 follow-ups (re-check 11-25).
