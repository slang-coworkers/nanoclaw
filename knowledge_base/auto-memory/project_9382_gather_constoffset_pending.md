---
name: PENDING 3-maintainer design call — #9382 Gather const-offset over-declares ImageGatherExtended
description: slang#9382 draft PR #11655 parked awaiting jkwak/csyonghe/skiminki convergence on _constoffset (opt-in) vs Option C (transparent auto-fix); fixer HELD
type: project
originSessionId: c87f17be-487a-47d5-be99-2d349a875808
---
shader-slang/slang#9382 — `Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` + `OpCapability ImageGatherExtended` for a compile-time-constant offset when it should use `ConstOffset` (no cap). Draft PR **#11655** @ `d5f5d1e2f` (held draft per standing rule; `report_pr_created` confirmed). Re-triage requested by jkwak-work 2026-06-17; verified reproducing at HEAD; superseded two stale drafts (#9741 jkwak's own + #9410).

**Design journey (why it's parked):**
1. Original fix = IR-legalize pass (conditional `ConstOffset`/`Offset` by constness). 3 reviewers APPROVE_WITH_NITS, 0 bugs.
2. jkwak objected to the fix LAYER — the PR manipulates spirv_asm-block internals in a pass (genuinely novel; precedent only covers placeholder resolution).
3. jkwak's 1st re-steer (helper-only `__requireImageGatherExtended` gating the cap while authoring `Offset`, letting spirv-opt fold the operand) was **INVALID at -O0** — `Offset`-without-cap before the fold runs. Caught by fixer verification before any code shipped.
4. -O0 finding collapsed viable options to **Option C** = first-class gather IR op + C++ emit choosing ConstOffset/no-cap vs Offset/+cap by constness. (A' drops runtime offset which jkwak wants kept; B/D = the rejected spirv_asm-pass manipulation.) Fixer raised C on the PR (r3493547575).
5. jkwak then floated on the ISSUE (comment 4835290712) a **`_constoffset`-suffixed separate meta.slang function** workaround AND pulled in **@csyonghe + @skiminki-nv** for help.

**The open design choice (maintainers' to make):**
- `_constoffset` opt-in workaround: valid at -O0 (authors `ConstOffset` directly), sidesteps the constexpr-blind overload limit — BUT the reported `Gather(const)` call WON'T auto-route to it (overload resolution is constexpr-blind), so the reported call still over-declares the cap.
- Option C transparent auto-fix: new gather IR op + emit-by-constness; the reported call gets fixed automatically.

**Why:** Slang overload resolution can't dispatch on a `constexpr` type modifier, so a separately-named function can't be auto-selected for constant offsets.

**Latest (2026-06-29):** jkwak then posted on the PR (4835398285) "can't make progress until we can overload by `constexpr` modifier" — a premise that's factually incomplete (Option C decides at EMIT TIME via a constant-object check on the offset operand, so it does NOT need constexpr-overloading and transparently auto-fixes the reported `int2(2,1)`). To avoid the issue being shelved on a non-existent prerequisite, authorized ONE deferential PR clarification (posted 4835425316) establishing the feature-independent path exists while deferring direction. It had a precision shorthand ("`IRConstant` check" — but `int2(2,1)` is an `IRMakeVector` of literals/`OpConstantComposite`, not an `IRConstant` leaf), corrected via a follow-up (4835497271): the real classifier is `isConstantGatherOffset` = IR literal OR `MakeVector`/`MakeVectorFromScalar` of literals (NOT `MakeArray` — offsets are vectors; that over-generalization came from Main's own guardrail draft, caught by the fixer). Edit-in-place 403'd (fixer GH_TOKEN invalid, CREATE-only) so a follow-up was the only route.

**How to apply:** Fixer is **HELD**. Do NOT auto-release until jkwak/csyonghe/skiminki converge on a concrete direction (name + mechanism + how constant offsets reach it) — a maintainer floating an alternative + looping in peers is NOT convergence (per reopen-≠-release). Triager owns the chain on canonical thread `gh-issue-shader-slang/slang-9382`; it bridged the issue↔PR threads (issue comment 4835358167) and will forward the resolution up on convergence. Don't post into the maintainer-to-maintainer discussion uninvited; correction posting is DONE (one comment + one follow-up) — no further posting unless a maintainer raises something new. **Validation gate:** the 3 variants (`int2(2,1)`, `int2(1)` splat → ConstOffset/no-cap; `int2(uv)` runtime → Offset/+cap) must pass `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` at **-O0** (spirv-asm masks the pre-fold invalid state). Separate out-of-scope latent bug flagged to maintainers: scalar `__texture_gatherCmp_offset` hard-codes ConstOffset on a non-constexpr offset.
