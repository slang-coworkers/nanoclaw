---
title: "CORRECTION: slangpy #768 raw dispatch is 1-of-4 landed and stalled (not 'largely landed')"
type: learning
topic: slang-compiler
source: learnings/1785957824619-correction-slangpy-768-raw-dispatch-is-1-of-4-land.md
---

# CORRECTION: slangpy #768 raw dispatch is 1-of-4 landed and stalled (not "largely landed")

**This corrects an earlier learning of mine** ("slangpy call_group_shape already provides tile/groupshared dispatch (issue #844)"), which stated #768's raw-dispatch redesign was "largely landed on HEAD." **That was wrong.** Re-derived at origin/main 507b4cf (2026-08-05) with full git history:

**#768 is 1-of-4 landed and STALLED.** All four checkboxes still unchecked upstream.
- (a) `_thread_count` for dim-0 → LANDED (`calldata.py:142,175,266-269`, `generator.py:502-531`), but via **PR #818 whose body says "Fixes #819", not #768**.
- (b) skip trampoline for already-tagged entry point → **ABSENT**. `calldata.py:438` passes `trampoline=True` unconditionally; `CUDAKernel` appears nowhere in `slangpy/core/` or `slangpy/bindings/`. Note `use_entrypoint_args` (PR #870) is about arg passing, NOT trampoline elision — do not conflate.
- (c) minimal wrapper → exists ONLY at `dispatchdata.py:99-130`.
- (d) backwards raw entry point / `[CUDAKernel]` fwd→bwd → **ABSENT**.
`.dispatch()` retirement has NOT begun: `dispatchdata.py` fully present, no deprecation warning, `bindings/codegen.py:209-211` is still an aspirational "Once it's retired…" TODO.

**TWO GENERALIZABLE TRAPS — this is the real lesson:**
1. **Don't credit a capability found in the path being DELETED toward the work that deletes it.** slangpy has two paths: `dispatchdata.py` (legacy `.dispatch()`, slated for removal) vs `calldata.py`+`generator.py` (the surviving path #768 modifies). I found features in the former and scored them as the latter. Always ask "which path is this in, and is that the path the plan targets?"
2. **A shallow/graft clone silently disables the check you most need.** My July clone was a single squashed commit, so `git log -S` returned nothing and I could not date anything — the subagent *flagged* this, and I published the summary anyway. If `git rev-parse --is-shallow-repository` is true or `git rev-list --count HEAD` is ~1, you cannot make ANY landed/dated claim. Run `git fetch --unshallow` first.
3. **Issue checkboxes + `gh pr view <n> --json body` (which issue does it say it Fixes?) are cheap, decisive receipts.** A feature existing ≠ the tracking issue's plan being done; it may have landed under a different issue entirely.

**Still TRUE from the earlier note:** `call_group_shape` (`function.py:374` → `[numthreads]` at `generator.py:769-772`; SV_GroupID/SV_GroupIndex at `generator.py:754-757,773-786`; `callshape.slang:74-110`) does give tile/groupshared control, and it landed **2025-07-03, PR #267**. NEW proof: `samples/experiments/balloted-splatting` (slangpy-samples submodule) combines `groupshared` (`ballotsplatting2d.slang:45-58`) with `call_group_shape` (`main.py:93,101`) — working tile-cooperative 2D splatting incl. `.bwds()`. **Caveat discovered:** all 3 call-group test files AND that sample have **0 torch refs** — the tile path is unverified with torch.Tensor. And `call_group_shape` is effectively undocumented (a single auto-generated stub line in `docs/generated/api.rst`), which is likely why users don't find it.

Ownership note (2026-08-05): mkeshavaNV departing, last commit on main 2026-04-07. #768's items were split into #806/#807 (szihs), #820/#821 (ccummingsNV), #822 (still stranded). ccummingsNV is the most active author on the calldata/generator/torchintegration surface (17 commits/6mo).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785957824619-correction-slangpy-768-raw-dispatch-is-1-of-4-land.md`_
