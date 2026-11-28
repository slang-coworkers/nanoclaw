---
type: project
title: "#13200 SPIR-V IntPtr/UIntPtr emit crash — PR #13202"
description: Chain record for the intptr_t/uintptr_t SPIR-V emit crash fix; draft PR #13202, maintainer -g round done 2026-11-27, awaiting human review
tags: [slang, spirv, intptr, emit, chain-record]
---

# #13200 → draft PR #13202 (our fix, awaiting human)

Issue: SPIR-V runtime `intptr_t` (IntPtr) crashes emit — `emitGlobalInst` missing
`OpTypeInt` case for `IntPtrType`/`UIntPtrType` (+ signedness classification gaps:
`isSignedType`, `getUnsignedTypeFromSignedType`, value-path arm). Bot-filed issue,
fixer-owned chain on thread `gh-issue-shader-slang/slang-13200`, branch
`fix/issue-13200`.

**State 2026-11-27 (maintainer `-g` round complete):** head `f4c8f5f5b9`,
MERGEABLE (clean origin/master merge through the #14514 reorg — all 5 fix sites
now in `source/slang/emission/` + `source/slang/ir/`), `pr: non-breaking`, 7
files +183/−1, CI at the bot-PR priority gate. 4 peer-review rounds, r4
APPROVE_WITH_NITS (0 bugs; one clarity finding declined with measured evidence).
tests/spirv 1251/1251, tests/llvm 31/31. Ready-flip → weekly undraft list.

**Maintainer round (skiminki-nv, cmt 7226935170, relayed as row 33):** with
`-g`, a pointer-sized local crashes the same missing type-decl case via the
debug type even when SCCP folds the value (no @mention in the live comment — no
`<github-post-authorized />` attached to the relay). Done: new test
`tests/spirv/intptr-emit-debug.slang` (2/2); A/B vs stock v2026.23 (crashes with
the exact reported error; fixed build → valid SPIR-V); issue replies 7227069684,
7227661103; explanation comment 7227561153 (head-refreshed).

**Adjacent dispositions:**
- #8480 concern (maintainer: `-g` path may hit it via `SizeAndAlignment`) —
  empirically falsified: with the fix, #8480's own repro (byte-address-buffer
  `-g`) compiles clean, same missing type-decl case. Re-enabling #8480's
  disabled vk test stays with that chain.
- #14747 (`-g0` in `tests/ir/sccp-int-compare-folding.slang`) is skiminki-nv's
  own PR; the `-g0` drops there once #13202 lands. Not ours to act on.

Background knowledge: wiki concept
`slang-backends-spirv-emit-and-legalization-defects.md` + learning 1790007665223
(don't switch to `getIntTypeInfo().isSigned` — trips a release assert).
