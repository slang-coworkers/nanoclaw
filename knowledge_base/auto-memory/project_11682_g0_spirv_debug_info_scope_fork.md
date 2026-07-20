---
name: project-11682-g0-spirv-debug-info-scope-fork
description: "#11682 slangc -g0 emits SPIR-V debug info — maintainer picked (b), but b1/b2 scope fork awaits jkwak steer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e3a655e-bbbe-4877-93f0-a652b1104daf
---

# #11682 — `slangc -g0` includes SPIR-V debug info (IN-FLIGHT, awaiting maintainer steer)

Bug/P3, `reproduced`. `-g0` (`DebugInfoLevel::None`) still emits `OpSource` (unconditional, `slang-emit-spirv.cpp:11824-11844`) and `OpName`/`OpMemberName` (from `IRNameHintDecoration`, not classified as debug info → bypasses the debug gate). Help text `Don't emit debug information at all.` over-promises.

**jkwak-work chose option (b)** (2026-07-18): gate names/source on `None`. BUT slang-fixer code-traced a scope fork the one-word steer didn't resolve:

- Default compile (no `-g`) resolves to the SAME `DebugInfoLevel::None` as explicit `-g0` — indistinguishable at emit site (`global-session.cpp:879` erases the distinction via Max(targets)).
- **b1 (literal):** gate on `None` → strips `OpName`/`OpSource` from EVERY default SPIR-V compile, not just `-g0`. User-visible default-output change + ~41 spirv/spirv-asm CHECK tests (friendly-name disassembly uses `SPV_BINARY_TO_TEXT_OPTION_FRIENDLY_NAMES` ← `OpName`). ~4-line emit change but big test sweep. Contradicts triage's "small fallout."
- **b2 (explicit -g0 only):** default preserved (~1 test, `debug-levels.slang`), matches issue title, but needs new plumbing to distinguish explicit-None from default-None — itself a small design call.

**State:** fixer posted b1/b2 clarification tagging @jkwak-work (comment 5011506198), recommends b2. **Holding build** until steer. jkwak's reply webhooks back to fixer's session directly — Main does NOT drive until then. Worktree `wt-slang-11682` @ base `aaa07fe296`; plan `/workspace/agent/reports/slang-11682.md` (fixer's fs). Adjacent SPIR-V debug work: #11550 / #11565.

**Triager independently re-verified (2026-07-18, HEAD `3292090b3`):** confirms default==`-g0`==`None` enum value 0 with no "was-explicitly-set" tracking; `stripDebugInfo()` doesn't strip `NameHintDecoration`. So literal fix changes default disassembly for everyone. **Caveat: fixer's "~41 tests" is an ESTIMATE** — triager confirmed the direction only + ~14-15 test files carry `CHECK.*OpName` (do NOT relay "41" as fact). Doesn't change the decision (hinges on "default output changes for everyone").

**jkwak steer #1 (comment 5013234042):** "default value for `-g` should be 1 (minimal, includes OpName+OpSource); `-g0` shouldn't include them." BUT fixer code-traced a mismatch between his mechanism and intent: Minimal (g1) = "line numbers," so flipping default→Minimal ALSO newly emits `OpString "<filename>"` (`IRDebugSource`, lowered only when level≠None, `slang-lower-to-ir.cpp:15425`→`slang-emit-spirv.cpp:2164`) + `OpLine` per statement (`maybeEmitDebugLine` early-returns at None, `:9908`). Today's default emits NEITHER — only OpName+OpSource. So literal-jkwak (A) turns on line tables for every default compile (~7 no-`-g` tests w/ body-level CHECK-NEXT break by OpLine adjacency).
- **(A) flip default→Minimal + gate names on None** (literal; accepts line tables on by default).
- **(B) keep default byte-identical to today, distinguish explicit `-g0`, gate names on explicit-None** (default unchanged, no line tables; `-g0`=nothing; ~1 test; small "explicitly-set" plumbing). Fixer recommends B; Main endorses B lean but it's jkwak's product call.

**jkwak steer #2 — RESOLVED (comment 5013397505, 2026-07-18):** picked **(A)**, verbatim: "We should go with 'A' and make the PR breaking-change. 'B' will mean that we introduce a new debug-level, which can be more confusing." So: flip default→Minimal + gate names on None, and the `OpLine`/`OpString` default-output change is an INTENDED breaking change (he explicitly rejected B). Build UNBLOCKED.

**State (2026-07-19):** fixer building (A): flip default None→Minimal (`global-session.cpp:879`); gate OpName/OpSource on level==None; refresh ~7-10 no-`-g` CHECK-NEXT golden tests broken by OpLine adjacency + invert `debug-levels.slang` CHECK_NONE; add breaking-change changelog note. → repro test → draft PR `Fixes #11682` → report_pr_created → review → `[Fix Report]`. Fixer owns E2E on this thread; Main does NOT drive unless flagged.

**Routing note (07-19):** fixer 11682 session = `sess-1782145314986-866vyp` (slang-fixer grp ag-1780667166439-vmjrwe). Its last processed inbound was 22:59 ("held one more round") — my prior-turn `<message>` (A)-steer dispatch may NOT have landed (container was stopped). jkwak then pinged bot for status (comment 5014568474). Re-sent (A)-GO + status-ping relay in ONE wake, pinned `target_session_id=sess-...866vyp` + `in_reply_to=52` (the fixer's last outbound) to guarantee it hits the worktree-bearing session, not a cold mint. Only ONE fixer 11682 session exists (no phantom double-session).

**IMPLEMENTED (07-19 05:57):** fixer built (A). Worktree wt-slang-11682 @ `a916653b70`. Patch 3 files +57/−24: `slang-compiler-options.cpp` getDefault(DebugInformation)→Minimal (verified Max(linkage,targets) at global-session.cpp:879 can't clobber explicit `-g0`); `slang-emit-spirv.cpp` new `shouldEmitDebugNames()` (!=None) gating 5 compiler name-hint OpName/OpMemberName sites + OpSource (USER spirv_asm OpName left ungated — different path, matches triage scope); tests `tests/spirv/g0-no-debug-info.slang` new + `debug-levels.slang` CHECK_NONE inverted. Status posted to jkwak (comment 5014581117).

**FULL-SUITE FALLOUT + 2ND FIX (07-19 06:40):** SPIR-V repro perfect, but full suite = 51 fail (not ~7-10): **(1) 19 INTERPRET/`slangi` VM crashes** — hard abort "unimplemented: VM bytecode gen for inst" = REAL functional regression; **(2) ~29 textual-target golden diffs** (HLSL/GLSL/Metal/CUDA `#line`+temporaries, SPIR-V id-renumber) = cosmetic. **Single root cause:** `slang-emit.cpp:1030` `stripDebugInfo` fires only at `None`, but comment `:1027` says strip "if target can't express debug info OR user specifies -g0" — only the `-g0` half was implemented; default==None masked it. Flip exposed it → debug insts survive to targets that can't consume them. Only SPIR-V + CPU/LLVM actually consume debug insts; textual no-op them; VM crashes.
**Main GREEN-LIT the root-cause fix (07-19):** extend `:1030` strip to also fire when target can't express debug info — finishes the comment's intent, NARROWS breaking surface to SPIR-V(+CPU) only, VM crash gone, ~48/51 failures vanish, jkwak intent preserved. In-scope (correctness fix to approved (A), not new design) so no jkwak pre-re-ask. **2 conditions:** (1) use existing target-capability query for "can express debug info", not a hardcoded list; (2) PR desc must document BOTH changes + full breaking surface (SPIR-V **and CPU/LLVM** change output — call CPU out explicitly). Fold finding into PR desc, not a separate interim comment. Rebuild → repro → confirm failures collapse to handful of SPIR-V goldens → draft PR (`pr: breaking change`, `Fixes #11682`) → report_pr_created → review → `[Fix Report]`. Main awaits PR/report; flag if residual golden set > handful.
