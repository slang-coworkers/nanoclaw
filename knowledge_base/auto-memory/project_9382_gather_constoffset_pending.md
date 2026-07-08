---
name: CLOSED (maintainer design call) — #9382 Gather const-offset over-declares ImageGatherExtended
description: slang#9382 draft PR #11655 CLOSED unmerged by jkwak-work 2026-07-08 (design-direction, not defect); issue stays OPEN as maintainer design thread (jkwak/csyonghe/skiminki); fixer held, branch preserved, re-dispatch only on convergence
type: project
originSessionId: c87f17be-487a-47d5-be99-2d349a875808
---
shader-slang/slang#9382 — `Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` + `OpCapability ImageGatherExtended` for a compile-time-constant offset when it should use `ConstOffset` (no cap). Draft PR **#11655** (branch `fix/issue-9382` @ `d5f5d1e2f9`) was the IR-legalization fix.

**TERMINAL — PR #11655 CLOSED unmerged 2026-07-08** by jkwak-work (closing comment #4910412519 → cites his issue comment #4835358167). Verified: PR `state=closed`, `merged_at=null`; issue #9382 `state=open`. This is a **maintainer design-direction call, not a defect** in the fix. jkwak favors a `_constoffset`-suffixed core-module helper over the emit-time / IR-legalize approach, and handed the final mechanism decision to @csyonghe / @skiminki-nv. Issue #9382 stays **open as their maintainer-owned design thread** — we do not touch it.

**Fixer action on closure (correct, do not second-guess):** no GitHub reply (closure posed no question, added no new content; a comment mid-design-discussion is noise and posting uninvited into a maintainer-to-maintainer thread is forbidden). Worktree + sentinel reaped. Branch `fix/issue-9382` @ d5f5d1e2f9 **preserved on origin** in case discussion picks the IR/emit path and re-dispatches. No empty-ack sent back to fixer.

**Design journey (why it landed here):**
1. Original fix = IR-legalize pass (conditional `ConstOffset`/`Offset` by constness). 3 reviewers APPROVE_WITH_NITS, 0 bugs.
2. jkwak objected to the fix LAYER — manipulating spirv_asm-block internals in a pass (novel; precedent only covers placeholder resolution).
3. jkwak's helper-only re-steer (`__requireImageGatherExtended` gating the cap, letting spirv-opt fold the operand) was **INVALID at -O0** — `Offset`-without-cap before the fold. Caught by fixer verification pre-ship.
4. -O0 finding collapsed viable options to **Option C** = first-class gather IR op + C++ emit choosing ConstOffset/no-cap vs Offset/+cap by constness (transparent auto-fix, valid at all opt levels).
5. jkwak floated the `_constoffset`-suffixed function workaround on the issue + pulled in csyonghe/skiminki. We posted one factual option-space clarification (#4835425316) + one precision follow-up (#4835497271), then held.
6. jkwak CLOSED the PR 2026-07-08 — direction is `_constoffset` (or whatever the 3 maintainers converge on), his team's call.

**Key constraint (for any re-dispatch):** Slang overload resolution is constexpr-blind, so a separately-named `_constoffset` function is opt-in — the reported `Gather(s, uv, int2(2,1))` call WON'T auto-route to it and would still over-declare the cap. Only an emit-time/IR constness check (Option C) transparently fixes the reported call. `_constoffset` authors `ConstOffset` directly so it's valid at -O0.

**How to apply:** Chain is **TERMINAL**. Fixer **HELD**. Do NOT auto-release, do NOT re-open, do NOT post to GitHub. Re-engage ONLY if a maintainer posts a concrete direction (name + mechanism + how constant offsets reach it) — that webhook re-opens the chain and re-dispatches to the fixer (per reopen rule: substantive human comment re-opens). A maintainer floating an alternative + looping peers is NOT convergence. Triager owns canonical thread `gh-issue-shader-slang/slang-9382`. **Validation gate on any re-dispatch:** 3 variants (`int2(2,1)`, `int2(1)` splat → ConstOffset/no-cap; `int2(uv)` runtime → Offset/+cap) must pass `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` at **-O0** (spirv-asm masks pre-fold invalid state). Separate out-of-scope latent bug already flagged to maintainers: scalar `__texture_gatherCmp_offset` hard-codes ConstOffset on a non-constexpr offset.
