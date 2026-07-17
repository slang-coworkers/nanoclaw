---
name: FIX DELIVERED (draft PR #12133) — #9382 Gather const-offset over-declares ImageGatherExtended
description: slang#9382 — backend-IR Option C implemented per jkwak's 2026-07-16 direction; draft PR #12133 OPEN (Main-verified), Closes #9382, all 3 prior PRs closed; awaiting maintainer review→ready→merge; PR stays draft
type: project
originSessionId: c87f17be-487a-47d5-be99-2d349a875808
---
shader-slang/slang#9382 — `Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` + `OpCapability ImageGatherExtended` for a compile-time-constant offset when it should use `ConstOffset` (no cap).

**FIX DELIVERED 2026-07-16 — draft PR #12133 (Main-verified @ this session).** Backend-IR Option C implemented exactly to jkwak's direction. Verified independently: PR #12133 OPEN draft, author `nv-slang-bot[bot]`, branch `fix/issue-9382-c`, `Closes #9382`, assignee+requested-reviewer jkwak-work. Mechanism (from PR body): new IR op `kIROp_ImageGatherOffset` (slang-ir-insts.lua + stable id **898**) + `__intrinsic_op` helper `__spirvImageGatherOffset` routing BOTH singular `__texture_gather_offset` `spirv` cases to it (the two `spirv_asm` blocks with hard-coded `OpCapability ImageGatherExtended;`+`Offset $offset` REMOVED); backend `emitImageGatherOffset` + `isConstantGatherOffset` (IRConstant leaf OR MakeVector/MakeVectorFromScalar of IRConstants) picks ConstOffset/no-cap vs Offset/+cap. **NO spirv_asm-block iteration** (the rejected mechanism); plural `__texture_gather_offsets` + shadow gatherCmp untouched. 3/3 variants PASS at **-O0** `SLANG_RUN_SPIRV_VALIDATION=1` (int2(2,1)+splat→ConstOffset/0-cap; runtime→Offset/1-cap); gh-5339 runtime guard + broader gather suite green; NonUniform propagation verified end-to-end (strictly better than removed asm form).

**All 3 prior PRs now CLOSED (Main-verified):** #11655 (07-08), #9410 (07-07), **#9741 (jkwak closed his OWN draft 07-16 01:24)**. jkwak's "close existing PRs" fully satisfied.

**Review/next:** 2 code-review agents + codex PLAN+CODE+OUTPUT approve, 0 correctness defects; peer review dispatched to slang-reviewer (advisory). Issue verdict refreshed in place (comment 4987047721). **PR stays DRAFT** (drafts-only guardrail) — a maintainer flips ready → merge. Auto-closes #9382 on merge. Recoverable build hiccup during dev (`$(kIROp_...)` splice capitalization) fixed same-turn, learning shared. Benign `ci_failed` webhook = draft priority-yield (33 builds skipped), self-reruns.

**RE-OPENED 2026-07-16 — maintainer gave concrete direction.** jkwak-work commented on issue #9382 (comment 4986908901, real `@nv-slang-bot` mention): close existing PRs, then create a NEW PR on the **backend-IR approach** — "remove the function body from the frontend such as *.meta.slang files, and re-implement the behavior on the backend by adding a new IR"; the backend figures out offset constness and decides which capability to request. This IS the previously-scoped Option C. Routed to slang-triager on canonical thread `gh-issue-shader-slang/slang-9382` with `<github-post-authorized />`. **Triager progress 07-16 (msg #70):** re-triaged @HEAD 623227f86e; **slang-fixer DISPATCHED** on canonical thread (memo msg 79 + triage-9382.md carrying exact HEAD line numbers, AVOID list, -O0 gate); **GitHub artifact posted** = issue #9382 comment 4987047721. Awaiting fixer's fresh draft PR (`Closes #9382`, report_pr_created) + [Fix Report], which triager forwards up. Triager's own architecture memo independently concluded Option C is the ONLY valid path (runtime-offset support ∧ no asm-walk ∧ valid at -O0) — no design ambiguity.

**PR-close step — verified state @HEAD 623227f86e (do NOT blanket-close):**
- **#11655** (our prior draft, `fix/issue-9382` @ d5f5d1e2f9) — already CLOSED by jkwak 07-08. Branch preserved on origin.
- **#9410** (Copilot) — already CLOSED 07-07.
- **#9741** — still OPEN but **authored/assigned to jkwak-work himself** (his own stale draft). Do NOT unilaterally close a maintainer's own PR; triager will surface, not force.

**Implementation direction (fixer released, PR stays DRAFT):** first-class gather IR op + C++ emit selecting `ConstOffset`/no-cap vs `Offset`/`ImageGatherExtended` from the offset operand's constness at emit/IR time. Remove `OpCapability ImageGatherExtended` + `Offset` authoring from the two singular `__texture_gather_offset` `spirv_asm` blocks in `hlsl.meta.slang`.
- ⚠️ **AVOID (jkwak explicitly rejected):** (a) iterating instructions inside the `spirv_asm` block (old #11655 `processImageGatherOffset`); (b) the `__requireImageGatherExtended` helper (invalid at -O0).
- The classifier `isConstantGatherOffset` (IR literal OR `MakeVector`/`MakeVectorFromScalar` of literals; NOT `MakeArray`) is reusable — but must run in the backend/emit for the new IR op, NOT by walking the asm block.
- **Validation gate (hard):** 3 variants must pass `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` at **-O0** (spirv-asm masks pre-fold invalid state): `int2(2,1)` + `int2(1)` splat → ConstOffset/no-cap; `int2(uv)` runtime → Offset/+cap. Regression test on all three.
- Separate out-of-scope latent bug already flagged: scalar `__texture_gatherCmp_offset` hard-codes ConstOffset on a non-constexpr offset.

**Design journey (why it landed here):**
1. Original fix = IR-legalize pass (conditional `ConstOffset`/`Offset` by constness). 3 reviewers APPROVE_WITH_NITS, 0 bugs.
2. jkwak objected to the fix LAYER — manipulating spirv_asm-block internals in a pass (novel; precedent only covers placeholder resolution).
3. jkwak's helper-only re-steer (`__requireImageGatherExtended` gating the cap, letting spirv-opt fold the operand) was **INVALID at -O0** — `Offset`-without-cap before the fold. Caught by fixer verification pre-ship.
4. -O0 finding collapsed viable options to **Option C** = first-class gather IR op + C++ emit choosing ConstOffset/no-cap vs Offset/+cap by constness (transparent auto-fix, valid at all opt levels).
5. jkwak floated the `_constoffset`-suffixed function workaround on the issue + pulled in csyonghe/skiminki. We posted one factual option-space clarification (#4835425316) + one precision follow-up (#4835497271), then held.
6. jkwak CLOSED the PR 2026-07-08 — direction is `_constoffset` (or whatever the 3 maintainers converge on), his team's call.

**Key constraint (for any re-dispatch):** Slang overload resolution is constexpr-blind, so a separately-named `_constoffset` function is opt-in — the reported `Gather(s, uv, int2(2,1))` call WON'T auto-route to it and would still over-declare the cap. Only an emit-time/IR constness check (Option C) transparently fixes the reported call. `_constoffset` authors `ConstOffset` directly so it's valid at -O0.

**How to apply:** Chain is **TERMINAL**. Fixer **HELD**. Do NOT auto-release, do NOT re-open, do NOT post to GitHub. Re-engage ONLY if a maintainer posts a concrete direction (name + mechanism + how constant offsets reach it) — that webhook re-opens the chain and re-dispatches to the fixer (per reopen rule: substantive human comment re-opens). A maintainer floating an alternative + looping peers is NOT convergence. Triager owns canonical thread `gh-issue-shader-slang/slang-9382`. **Validation gate on any re-dispatch:** 3 variants (`int2(2,1)`, `int2(1)` splat → ConstOffset/no-cap; `int2(uv)` runtime → Offset/+cap) must pass `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` at **-O0** (spirv-asm masks pre-fold invalid state). Separate out-of-scope latent bug already flagged to maintainers: scalar `__texture_gatherCmp_offset` hard-codes ConstOffset on a non-constexpr offset.
