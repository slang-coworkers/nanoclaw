---
name: project-11682-g0-spirv-debug-info-scope-fork
description: "#11682 slangc -g0 emits SPIR-V debug info. MERGED docs-only (PR #12201, 2026-07-23): after 6 maintainer round-trips, jkwak's final call was to fix only the over-promising help text and change zero behavior. Durable compiler + process lessons below."
metadata:
  node_type: memory
  type: project
  originSessionId: 9e3a655e-bbbe-4877-93f0-a652b1104daf
---

# #11682 — `slangc -g0` includes SPIR-V debug info (✅ MERGED, TERMINAL)

**Outcome (07-23 22:06:40Z, Main-verified via gh):** PR **#12201 MERGED by jkwak-work** (merge commit `b629210213`); #11682 CLOSED/completed via `Fixes #11682`. Landed **docs-only, 3 files +5/−2, `pr: non-breaking`, ZERO behavior/test change**: `-g0`/none help text corrected to *"Don't emit debug information. This is the default. For SPIR-V, OpSource, OpName and OpMemberName are still emitted."*; `getDefault(DebugInformation)`→None made explicit (no-op); regen `command-line-slangc-reference.md`. Maintainer APPROVED after 1 round; peer review APPROVE_WITH_NITS/0 bugs; real CI green. **Nothing routes through Main.**

## The bug as filed
`-g0` (`DebugInfoLevel::None`) still emitted `OpSource` (unconditional, `slang-emit-spirv.cpp:11824-11844`) and `OpName`/`OpMemberName` (from `IRNameHintDecoration`, not classified as debug info → bypassed the debug gate). Help text "Don't emit debug information at all." over-promised. Default compile (no `-g`) resolves to the SAME `DebugInfoLevel::None` as explicit `-g0` — indistinguishable at the emit site (`global-session.cpp:879` erases the distinction via `Max(targets)`), which is the root of the whole scope fork.

## ⭐⭐⭐ Durable compiler facts (the keepers)
These are latent, verified in source, and outlived the fix — worth carrying regardless of how #11682 landed:

1. **`stripDebugInfo` has a dangling-condition bug.** `slang-emit.cpp:1030` strips only at `None`, but its own comment (`:1027`) says strip "if target can't express debug info OR user specifies -g0" — only the `-g0` half was ever implemented; `default==None` masked it. Any change that lets debug insts survive to a target that can't consume them (textual targets no-op them; **the `slangi` VM hard-aborts** "unimplemented: VM bytecode gen for inst") exposes it.
2. **`IRDebugLine` perturbs OPTIMIZATION SHAPE, not just output.** `isSmallBlock()` (`slang-ir-loop-inversion.cpp:22-35`) counts `getOrdinaryInsts()` against threshold 4 inside `isSuitableForInversion`; an `IRDebugLine` inst is counted → tips a ≤4-inst loop-condition block over → loop inversion is disqualified. Likewise `IRDebugLine.mightHaveSideEffects()==true` (no pure flag) and it is not in `deferBufferLoad`'s allow-list → `slang-ir-defer-buffer-load.cpp:200` `default: return false` → stops deferring loads. BOTH run BEFORE the `None`-only `stripDebugInfo`, so the strip can't undo them. ⇒ turning on line tables at the default compile silently changes generated code for every no-`-g` build. (The principled long-term fix — exclude `IRDebugLine` from the `isSmallBlock` count and the side-effect check so debug info never affects optimization — is a latent correctness bug worth its own issue, out of scope for this bugfix.)
3. **Debug-level plumbing:** `-g1`/Minimal newly emits `OpString "<filename>"` (`IRDebugSource`, lowered only when level≠None, `slang-lower-to-ir.cpp:15425`→`slang-emit-spirv.cpp:2164`) + `OpLine` per statement (`maybeEmitDebugLine` early-returns at None, `:9908`). Friendly-name SPIR-V disassembly (`SPV_BINARY_TO_TEXT_OPTION_FRIENDLY_NAMES`) is driven by `OpName`, which is why stripping names at the default broke ~273 no-`-g` CHECK tests that assert named ids (`%main`, `%samplers`).

## ⭐⭐⭐ Durable process lessons
- **Never end a turn waiting on a background-subagent completion notification — it dies on container teardown.** The fixer kicked off a background master-baseline subagent + "I'll act on its completion" and ended the turn; two instruction-update restarts tore the container down, the notification never survived, and the fixer waited **3 days** for a wake that never came (jkwak pinged twice). Use a synchronous blocking `Agent`; arm a teardown-independent watchdog if a background run is unavoidable. See [[feedback_in_session_monitors_dont_survive_teardown]].
- **Measuring the true cost of a behavior change steered the maintainer to the cheap fix.** Each fixer escalation surfaced a real cost jkwak hadn't priced; when the final measurement showed ~273 test edits (≈8× the ~34 he'd picked -g0-default to avoid), he pivoted to docs-only. Surface measured cost with a "confirm given this, not re-decide from scratch" framing when a maintainer has already chosen.
- **Estimates relayed as facts mislead:** first fallout estimate ~7-10 tests → ~41 → ~111 VM → ~273. Flag estimates as estimates (the triager corrected "~41" to "direction confirmed, ~14-15 files" early).
- **PR-cleanliness gate:** temporary instrumentation (`SLANG_DBG2_11682`) added while root-causing must be stripped before the PR routes to review; verify a clean diff.
- **Don't relay a figure across a merge queue without the right instrument** (see finding above; `getDefault`-explicit and `include/slang.h` ABI restraint were both correctly held out of scope).

## ARC (audit trail — each fixer escalation surfaced a real cost jkwak hadn't priced)
triage (a)/(b) → jkwak "(b)" → fixer flags default==g0 → b1/b2 → jkwak "default→Minimal" → fixer flags Minimal adds OpLine/OpString → jkwak "(A), breaking" → build surfaces a ~111-test `slangi` VM regression (dictionary-miss post-strip) + an optimization-shape change (`isSmallBlock` threshold-4 counts `IRDebugLine`) → jkwak "make -g0 the default" → fixer proves both regressions vanish BUT ~273-test friendly-name fallout → **jkwak FINAL "don't edit tests, fix the doc" = original triage option (a)**. 6 maintainer round-trips. Recovered a 3-day dead-promise stall along the way (see process lessons). **Deferred non-blocking follow-up** (mutually verified, out of scope): 2 stale "at all" doc comments at `include/slang.h:905` + mirror `tools/gfx/slang.slang:229` — a future comment-only PR if anyone wants it.
