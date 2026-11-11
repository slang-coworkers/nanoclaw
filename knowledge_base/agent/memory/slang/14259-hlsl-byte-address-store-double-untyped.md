---
type: chain
title: slang#14259 — HLSL constant double RWByteAddressBuffer.Store emits untyped `.Store(` → DXC f32 store
description: Human-filed (tdavidovicNV) 2026-11-03. TRIAGED bug/high/P2, emit-layer root cause. #14322 (`L` suffix) MERGED 11-05, so the repro is fixed; the issue stays open. On 11-09 the 4th approach, DRAFT #14416 (strongly-typed HLSL literals), replaces #14385; #14276 fate open. Waiting on peer review, then skiminki-nv. Dated log in the sibling history file.
tags: [hlsl, byte-address-buffer, double, emit-c-like]
---

# slang#14259 — constant `double` `RWByteAddressBuffer.Store<double>` → untyped HLSL `.Store(0U,42.0)`

**Ask.** `output.Store<double>(0, double(42.0))` emitted `.Store(0U,42.0)` with no template arg. DXC infers `float` and lowers it to
`dx.op.rawBufferStore.f32`, which writes 4 bytes. The reporter pointed at the `kIROp_ByteAddressBufferStore` case in
`slang-emit-c-like.cpp` (Load keeps its type, Store doesn't). Runtime doubles, `RWStructuredBuffer<double>` and int64 constants are fine.
Reported on v2026.20.

Dated history (triage, the four maintainer asks, relays, corrections): [[slang/14259-hlsl-byte-address-store-history.md]].
New dated entries go there, not here.

## Current state (2026-11-09 ~11:25Z)

- **Owners:** triager owner session sess-1793741880740-mvymkh (it is the fixer's parent and keeps the sentinel until #14276 resolves);
  fixer sess-1793742971321-k0j5bx. Relay maintainer asks to the triager session, verbatim, with `<github-post-authorized />` when the
  comment mentions the bot.
- **Assignee / decider:** skiminki-nv (repo admin), who has redirected the approach three times.
- **Timer:** one-shot `recheck-14259-approach-p-fd8e` (11-11 12:00Z); supervisor-state entry advisory:maintainer-decision.
- **Next:** peer review and the [Fix Report] on #14416. Then skiminki-nv reviews it, answers the DXBC question, and picks #14416 or #14385.
  Ready-flip pending (weekly list).

| PR | approach | state | notes |
|----|----------|-------|-------|
| #14276 | type the HLSL `Store<T>` call; also fix C++/CUDA widths | DRAFT @ 860cc7501 | R2 APPROVE_WITH_NITS. HLSL CHECKs conflict with master's `42.0L`. Its C++/CUDA width fix is covered by no other PR. Fate undecided. |
| #14322 | `L` suffix on finite HLSL double literals | **MERGED 11-05** 4a6758601 | Repro fixed. Not covered: `half`, inf/NaN, C++/CUDA. |
| #14385 | casts for half literals and NaN/±Inf | DRAFT @ 046b09c | 10/10 cases f16/f32/f64 under DXC cs_6_6. Replaced by #14416 if that lands. |
| #14416 | strongly-typed HLSL scalar literals (suffix or `int16_t(..)` cast) | DRAFT @ 6c2d639, 54 files | See below. |

**#14416 details (cmt 6738674373):**
- Every row of the maintainer's table matches DXC, except that `0L` / `-0L` / `0x0L` are typed **uint**. So int zero is emitted as `int(0)`,
  and other int values use `NL`.
- The SM 6.6 end-to-end test passes bit-exact on the vk lanes, denormals and -0.0 included. Those lanes exercise the SPIR-V path, not the HLSL
  change. The dx12 lanes, the FXC lane (`-dx12 -use-dxbc cs_5_1`) and the DXBC CHECKs are Windows-CI only, and the PR says so.
- **Merge-blocking open question:** did skiminki-nv mean DXBC when they wrote "DXIL" for SM 5.1?
- Caveats: 52 docs/generated tests that check `int(N)` break the advisory nightly and need a regen. Whether FXC accepts `NL`/`h` in array
  sizes, case labels and matrix dims is Windows-CI only.
- Not filed (triager hypothesis, unverified): vk arithmetic may lose inf/NaN/-0.0 unless SPIR-V `SignedZeroInfNanPreserve` is set.

**Still open in this chain:** the fate of #14276 and the C++/CUDA widths. On C++/CUDA the `float` NaN store wrote **8** bytes and the
`double` inf store wrote 4. Related: #14161 (half inf/NaN, jkwak-work) and human PR #13927, which rebases on its own.

## Side finds (all filed-only; sibling Main sessions own dispatch, this session dispatches nothing)

| issue | what | disposition |
|-------|------|-------------|
| [#14282](14282-hlsl-rov-bab-templated-load-dxc-reject.md) | ROV `Load<T>` emitted templated, DXC rejects | held: jkwak-work self-assigned + Q1 2027 milestone |
| [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md) | CPU/CUDA `Store<bool>` writes 1 byte | resumes on a human signal |
| [#14323](14323-hlsl-sm5-double-byte-address-uint64.md) | FXC SM 5.x double byte-address → uint64 / templated | `recheck-14323-after-1425-4d9c` (11-11) |
| [#14386](14386-floattohalf-half-nan-signaling.md) | `FloatToHalf` narrows NaN to a signaling NaN | `recheck-14386-floattohal-2ff9` (11-13). Related: [[imported/project_13857_llvm_constant_float_quiets_signaling_nan.md]] |

## Lessons

- A `pr_mention` webhook body has its leading `@nv-slang-bot:` stripped. Read the GitHub comment before relaying without the marker
  ([[feedback_pr_mention_body_strips_leading_mention.md]]); on 11-09 a brief went out without it and had to be re-sent.
- The vk lanes do not stand in for a DXC/DXIL end-to-end check. dx12 and FXC run only on Windows CI, so say "pending on Windows CI" on GitHub.
- When a maintainer redirects the approach, open a separate draft and leave the earlier PRs untouched until they choose.
- 11-09 12:23Z **#14416 [Triage Resolution]**: partial. Head 029ff58, 56 files, +731/−182, still a draft.
  - Implementation and the local checks are done. Peer R1 APPROVE_WITH_NITS, 0 bugs; nits applied.
  - 54 docs/generated lanes are in `expected-failures.txt`.
  - Pending on Windows CI: the dx12 SM 6.6 end-to-end lanes, the FXC `-use-dxbc` lane, and the DXBC CHECKs. CI run 42614808861 is waiting for a maintainer to prioritize it.
  - Waiting on skiminki-nv for three things:
    - DXBC = "DXIL" at SM 5.1? (blocks the merge)
    - #14416 or #14385?
    - prioritizing CI
  - The fixer edits its 09:33Z ack in place to show this state.
  - **My decision (12:25Z):** the docs/generated regen follow-up issue is filed only when #14416 merges. The triager files it then, as part of its merge report. No issue about an unmerged change.
- 11-09 13:33Z **skiminki-nv answered all three questions** (cmt 6741338648, no mention):
  1. DXBC at SM 5.1 = yes, so the merge blocker is gone; DXBC checks only "if doable in a reasonable manner".
  2. **#14416 is chosen** ("cleaner with less casts").
  3. CI prioritized.
  - #14416 is now non-draft at 029ff58, with CI running. I relayed the answers at 13:34Z (in_reply_to=182). My note:
    - don't close #14385 or #14276 yet;
    - after the merge, propose closing #14385 as superseded and say that #14276's C++/CUDA width part is still open;
    - treat failures on the Windows lanes as real.
  - **Now waiting on:** #14416 CI, then the maintainer merge. At merge, the triager files the docs/generated regen follow-up.
- 11-09 14:59Z **#14416 CI run 42626460801 @ 029ff58**: red on 1 lane, the same on Windows Debug and Release (fixer-reported).
  - Green: the SM 6.6 dx12 end-to-end test (ints and floats, fp32 denormals, the -0.0 sign) and the SM 5.1 HLSL + FXC DXBC CHECKs. So FXC accepts `NL`, `h` and
    `(1.0L / 0.0L)`. The rest of the suite is green.
  - Red: `gh-14259-hlsl-typed-literals-sm51.slang.3 (dx12 -use-dxbc)`, word 7. `asuint(-0.0f * one)` lost the sign under FXC/D3D. The words after it are unknown.
  - Fix in progress: change the -0.0 rows to the select form `s == 1 ? -0.0 : one`. The original word 7 stays on record in the PR as a finding.
    If the select form also drops the sign, it is reported as FXC's handling of `-0.0`, and the check is not loosened.
- 11-09 19:31Z **Re-run 42640802392 @ ad6c802**: red again on the same FXC lane. The select form `s == 1 ? -0.0f : oneF` also loses the sign, so the
  `-0.0` literal itself loses it under D3D12+FXC, at an unidentified stage (Slang's HLSL text is `-0.0f`).
  - skiminki-nv (PR cmt 6749121349): "downstream compiler issue dropping the minus sign". They suggested removing the -0.0 line, since DXC covers it.
  - The fixer (cmt 6749238072) removed all three SM 5.1 -0.0 stores, and said openly that this is broader than the suggestion. Head b462124. The finding stays recorded in the explanation.
  - Not filed: the stage is unknown and probably downstream.
  - CI run 42683282272 @ b462124 is waiting on the priority gate (a maintainer action).
- 11-09 20:57Z **Run 42683282272 @ b462124**: red on the same FXC lane, now failing at word 13.
  - Words 0–12 match. That includes `0.1L*oneD` = 0x3FB999999999999A, which proves FXC gives `L` the double type.
  - The failure: `DBL_MAX * oneD` has the wrong low word. Note that DXC passes on the same HLSL text, so the literal text is fine and the loss is in FXC.
  - Head 38c8284 removed the DBL_MAX row by analogy with the -0.0 removal, disclosed on the PR (cmt 6751142817).
  - The triager flagged that skiminki-nv approved only the -0.0 removal, and told the fixer:
    - **no further row removals without the maintainer's OK**;
    - report each mismatch on the PR as a finding, with a keep/remove question;
    - get all remaining FXC mismatches in a single run.
  - Next: run 42696918574 @ 38c8284. Rows FXC has not reached yet: the double ±Inf/NaN products and the 4 half rows.
- 11-09 22:35Z **Run 42696918574 @ 38c8284**: the FXC lane now matches words 0–21, including the double ±Inf words and the NaN low word.
  - Word 22 fails: the double NaN high word, read from FileCheck's "scanning from here" note as `FFF02000` (inferred, not dumped). That would be a sign-set signaling NaN.
  - Nothing was removed. The finding is posted with a keep/remove question to skiminki-nv (PR cmt 6753215248). The check stays strict until they answer.
  - Head 82bb5ba adds 4 independent dx12 lanes for the half words, so run 42712523888 reports every remaining mismatch at once.
  - **Parked on skiminki-nv** (word 22, plus any half failures). Their reply routes to the fixer through the PR mapping. Timer: recheck-14259-approach-p-fd8e (11-11).
- 11-09 23:55Z **Run 42712523888 @ 82bb5ba** gives the full list: all 4 half lanes pass on dx12 FXC, and the rest is green.
  - The **only** failure left is word 22, the FXC double NaN high word (FFF02000).
  - Status posted fresh: PR cmt 6754721409 and issue cmt 6754721673.
  - **Parked on skiminki-nv:** remove the double NaN row, or keep it strict? Nothing is removed until they answer. Timer: 11-11.
  - At merge, the triager files the docs/generated regen follow-up.
- 11-10 09:08Z skiminki-nv (PR cmt 6763431411): "Please remove this check. Leave a comment behind on why this is not checked."
  - Head cb5434a stops checking the SM 5.1 double NaN words 21–22, and adds a test comment. The store and the HLSL spelling check stay.
  - CI run 42789122903 is pending, and green is expected. The branch is BEHIND master by 9 commits, with mergeable clean; left to the merge queue.
    If an up-to-date branch is required, the fix is a master merge, not a rebase.
  - Next: CI, then the maintainer merges, then the regen follow-up issue. After that, propose closing #14385.
