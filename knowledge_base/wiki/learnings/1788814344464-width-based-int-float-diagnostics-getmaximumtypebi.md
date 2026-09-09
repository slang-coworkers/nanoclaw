---
title: "Width-based int→float diagnostics: getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — pointer-sized literal false-positive trap"
type: learning
topic: verification
source: learnings/1788814344464-width-based-int-float-diagnostics-getmaximumtypebi.md
---

# Width-based int→float diagnostics: getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — pointer-sized literal false-positive trap

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788797776793-mbc60j
written_at: 2026-09-07T20:52:24.464Z
---

# Width-based int→float diagnostics: getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — pointer-sized literal false-positive trap

When reviewing (or writing) a lossy integer→float/double diagnostic that keys off source *width*, watch for pointer-sized integer types. `getMaximumTypeBitSize(Type*)` in `source/slang/slang-check-conversion.cpp` returns **64 for `BaseType::IntPtr`/`UIntPtr`** (it's the *maximum* possible width, not the target's actual pointer width). And Slang integer literals CAN be pointer-typed — the parser has `IntegerLiteralWidthSuffix::Pointer` (slang-parser.cpp ~8471-8595), so a pointer-suffixed literal reaches any literal-based diagnostic branch.

Consequence for shader-slang/slang#12931 (lossy int→float warnings): the default-on "definite loss" literal branch reduces the literal payload to the source width before the magnitude check, but with `sourceBitWidth==64` the reduction is skipped entirely. On a target whose pointer is 32-bit, a pointer-suffixed literal whose value is lossy at 64 bits but exact at 32 (i.e. negative/small when truncated to the real width) yields a spurious warning. Diagnostic-only (can't miscompile), narrow, target-dependent — but exactly the false-positive class such a PR is trying to avoid, and `-warnings-as-errors` amplifies it. Fix pattern: exclude `IntPtr`/`UIntPtr` from a "provably lossy" branch (they aren't fixed-width, so provability doesn't hold), or document the conservative behavior.

Two process lessons: (1) Run the `codex-critique` OUTPUT_REVIEW gate BEFORE emitting a `[Review Verdict]`/`[Resolution]`, not after — here it caught two real items (this intptr edge + a missing-doc requirement) that six reviewer subagents across three rounds missed; emitting the marker first tripped the gate-audit hook. (2) Before relaying a codex must-fix to the author, VERIFY each against ground truth — codex flagged "docs update required" (real: issue #12929 says so) but it's gated on PR #12039 which is still OPEN, so it's a deferred follow-up not a blocker; and codex re-litigated a design decision (default-on vs -Wpedantic) that was already surfaced + maintainer-ratified. Feed the missing context back via codex-reply; it approved on round 2.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1788814344464-width-based-int-float-diagnostics-getmaximumtypebi.md`_
