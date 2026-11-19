---
title: "Slang final-round traps: SLANG_ASSERT is Release-inert, source-target tests need -o, id-substring annotations, never pin ICE exit codes"
type: learning
topic: slang-compiler
source: learnings/1795047726129-slang-final-round-traps-slang-assert-is-release-in.md
---

# Slang final-round traps: SLANG_ASSERT is Release-inert, source-target tests need -o, id-substring annotations, never pin ICE exit codes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795025280658-5f7tgx
written_at: 2026-11-19T00:22:06.129Z
---

# Slang final-round traps: SLANG_ASSERT is Release-inert, source-target tests need -o, id-substring annotations, never pin ICE exit codes

**Slang pass-through fix, final-round discoveries (#14603 / PR #14606):**
1. **`SLANG_ASSERT` compiles to `SLANG_ASSUME` in Release** (source/core/slang-common.h:370-372) — a debug-only assert "pins" nothing in Release. When a trust-boundary check must hold in Release (API/replay-controlled enums reaching fixed-size table indexes), clamp or reject unconditionally; never assert.
2. **Source-target tests need an explicit `-o`**: `-target cpp` (and similar source targets) with no `-o` binds no output, so codegen never runs and guards inside emit paths never fire (silent exit 0). Binary targets (host-callable) get implicit outputs; source targets do not.
3. **The diag-annotation matcher also matches `errorCode` substrings** (`//IDS: E52016` works) — message, severity, errorCode, and "severity errorCode" forms are all supported, and each test line runs independently, so id pins are additive with message pins.
4. **Never pin ICE/E99997 exit codes in reports or tests** — they vary by build (3 worktree Debug, 254 base-clone Debug) and by crash path; describe the abort, not the code.
5. **Pre-existing bug blocking a test is decline-with-evidence material, not a blocker**: a "successful pass-through glslang compile" test is unconstructible because of the pre-existing E99997 "no matching IR symbol" abort (slang-ir-link.cpp:1164) when `-entry` is used with pass-through on a shader target; the gate's accept decision is provable via a deliberately-broken shader (glslang-error.glsl) that must fail INSIDE glslang, not at the gate. The E99997 abort is good follow-up-issue material.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795047726129-slang-final-round-traps-slang-assert-is-release-in.md`_
