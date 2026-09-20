---
name: project_12046_modulus_remainder_audit
description: "#12046 modulus/remainder audit — SHIPPED/TERMINAL. PR #12130 MERGED 5bd8eb89 @head 200d6f5f39 (2026-07-16). All 5 findings landed; approver BLOCK (RED_BUG) vindicated. Durable: trunc-vs-floor Remainder/Modulus discriminator + spec receipts."
metadata:
  node_type: memory
  type: project
  originSessionId: b3dee100-6647-4f34-a90c-7f197c687c31
---

# #12046 modulus/remainder audit — SHIPPED (terminal)

shader-slang/slang#12046, a **maintainer-opened scrutiny/audit umbrella** (skiminki-nv, Type=Performance, Metal/GLSL): "scrutinize the modulus/remainder operators and emitted instructions on different targets." Not a single handed-off bug.

**✅ TERMINAL — PR #12130 MERGED 2026-07-16 04:46Z** (merge `5bd8eb89`, at fixed head `200d6f5f39`, by jkwak-work; issue auto-closed via `Fixes #12046`). All five findings shipped with regression tests. Re-open only on a fresh substantive human comment.

## Durable knowledge: the Remainder/Modulus discriminator

The whole chain turned on one distinction, worth keeping because it settled a 4-round maintainer dispute:

- **Remainder** — sign follows the **dividend**; closed form `a − b·trunc(a/b)` (trunc = round-to-zero). Slang `%`(float) and `fmod()` are Remainder; both lower to IR `kIROp_FRem` → SPIR-V **`OpFRem`** (no `kIROp_FMod` exists). Metal `fmod` is **also Remainder** (MSL Spec §6.6 Table 6.4 p207: `fmod(x,y)=x − y·trunc(x/y)`).
- **Modulus** — sign follows the **divisor**; closed form `a − b·floor(a/b)`. GLSL `mod()` is floor-Modulus → SPIR-V **`OpFMod`** (sign = Operand 2).
- They differ only for mixed-sign operands: `-1.5 % 2.0 = -1.5` (Rem) vs `mod(-1.5,2.0) = 0.5` (Mod); `-7 % 3 = -1` (Rem) vs `2` (Mod).

## What shipped (the five findings)

- **F1 [real GLSL correctness bug]** `slang-emit-glsl.cpp:2601` — the raw `%`/`FRem` GLSL-text path emitted `mod()` (floor-Mod), wrong for negative operands (`-7%3`→2, should be -1). Uncovered because PR #3470 (2024) fixed only the SPIR-V-direct emitter, never `slang-emit-glsl.cpp`. Fix: `sign(x)*mod(abs(x),abs(y))` (branchless, vector-valid) + a **GLSL-text-target** regression test — the target `frem.slang` never exercised.
- **F2** `mod()`→spirv now emits a single `OpFMod` (was `default: x−y·floor(x/y)`, 4 instrs) across 3 overloads + FileCheck `OpFMod`/`-NOT OpFloor`.
- **F3** Metal `fmod` wrapper simplified to plain `fmod` — an output-**unchanged** cleanup (the sign-flip was a Rem→Rem no-op once Metal fmod is known to be Remainder), plus corrected the wrong `:11248` "Modulus" comment label.
- **F5 + comment table** — docs closed-form for Remainder; `hlsl.meta.slang:11254` table header `x=i·y+f` → `x−y·trunc(x/y)`.

## Durable lessons (also captured as shared learnings)

- **Don't reflexively concede to a maintainer assertion.** jkwak-work disputed F3/F2/F5 across 4 comments (incl. an MSL-spec screenshot); every finding held after re-verification against **primary sources** (curl+pypdf when WebFetch 403'd on Khronos/the 14MB PDF), and jkwak converged: *"trunc is Remainder and floor is Modulus."* Verify against the spec, then re-ground or own — do not adjudicate maintainer-vs-maintainer, surface the truth table and let them settle wording.
- **An output-byte-identical change can still break `COUNT-N` FileCheck pins.** F3 turned a two-`fmod(`-token ternary into one token; a pre-existing Metal test still asserted `METAL-COUNT-2: fmod(` and three `test-slang` jobs failed. The blast-radius grep checked SPIR-V Floor pins + int `%` but not Metal fmod **token counts**. Grep test-count pins, not just logic sites.
- **Approver BLOCK (RED_BUG) vindicated** — the follow-up commit fixed exactly the two files the approver named. Two calibration learnings mined: `ci_green_on_sha` read the combined-status API (blind to check-runs → false-safe; human APPROVE landed ~8 min before test jobs finished; only the Step-3 challenger's direct check-run inspection caught it); and **diff decided-vs-merged head before joining a human verdict** (merged head ≠ decided head ⇒ recorded `human_verdict=SUPERSEDED_CHANGES_REQUESTED`, not plain agreement).
- **PR-thread vs issue-thread divergence spawns a duplicate same-identity session.** An `issue_comment`-on-PR stamped `gh-issue-…-12130` didn't match the fixer's issue-keyed working thread `gh-issue-…-12046`, so it minted a second slang-fixer session (the legitimate approver→fixer CI-red follow-up) instead of resuming the original. Not harmful here, but the mechanism: key PR follow-ups on the canonical issue thread or pin `target_session_id`.

**Residual (out of scope, not a live chain):** F4 — GLSL integer `%`/`IRem` negative-operand behavior (`slang-emit-glsl.cpp:2627` TODO); revisit only if a maintainer asks.

**Dup history:** #1059 (closed via #3470, set current semantics), #5026 (closed), #10071 (open, autodiff fmod grad — distinct). Related parked maintainer-scrutiny: [[project_12035_overload_diag_reasons]], [[project_12023_compileperf_sweep_abstain_policy]]. Cross-ref: [[command_grep_markdown_strip_emphasis_before_matching]].
