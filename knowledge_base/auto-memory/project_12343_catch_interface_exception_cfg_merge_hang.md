---
name: project_12343_catch_interface_exception_cfg_merge_hang
description: "slang#12343 — catch handler CALLING a method on an interface-typed caught exception hangs slangc; root cause = inner block-merge walk in slang-ir-simplify-cfg.cpp:961-976 mutated by replaceUsesWith's re-hoisting. Draft PR #12348 held. NOT the same producer as #12361 (measured)"
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12361-followup
---

# slang#12343 — interface-typed caught exception + method call → compiler HANG

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-04 15:12Z. `Dev Opened` + `reproduced`.
https://github.com/shader-slang/slang/issues/12343

**Triaged by slang-triager 08-04.** Memo `triage-12343.md`, 114 lines, re-sent to me 08-05 07:48Z
(inbox `a2a-1785916137643-xjwljy/`). ⚠️**Nothing here is my own measurement** — the numbers and the
mechanism are the triager's; what I verified myself is marked MINE below.

**Repro:** `interface IFace { int getVal(); }` + `struct ABC : IFace`; then
`do { IFace abc = ABC(); throw abc; } catch (IFace abc) { abc.getVal(); }` →
`slangc -target hlsl …` spins forever, no output, no diagnostic, **flat RSS** (spinning, not blowup).
Removing the `abc.getVal()` call → exit 0. Front-end / target-independent (`-skip-codegen` also hangs).

**Root cause (triager's, instrumented + independently re-verified):** the **inner** instruction-move
walk of block-merge in `processFunc`, `slang-ir-simplify-cfg.cpp:961-976` — **not** the outer `for(;;)`
fixpoint at `:854`. `replaceUsesWith` on the catch param re-parents **4 hoistable insts**
(`lookupWitness`, `extractExistentialType`, `extractExistentialWitnessTable`) out of `successor` and
into `block` as a side effect, via `_replaceInstUsesWith` (`slang-ir.cpp:8975`) →
`_addGlobalNumberingEntry` (`:9114`) → `tryHoistInst` (`slang-ir-deduplicate.cpp:67` → `:106-109`).
From then on the loop variable already lives in the destination, so `removeFromParent(); insertAtEnd(block);`
merely **rotates block's own child list** and `next` is recomputed from that rotating list — a stable
3-inst cycle. The interface type *and* the method call are both required because the call is what
generates the hoistable existential insts.

**Fix:** Approach A — move all non-`Param` children first, *then* replace params, so no inst crosses
the source/destination boundary mid-walk. Approach C (outer-loop iteration cap) **REJECTED on
evidence** — cannot terminate an infinite *inner* loop; it would mask. ⛔**Do not re-propose C.**

## State — what I verified MYSELF (Main, 08-05)

- **Draft PR #12348** `fix/issue-12343` @ `72b528b42d`, OPEN, **still a draft**, `mergeable MERGEABLE`
  but `mergeStateStatus BEHIND`, `diverged`, `ahead 1`.
- ⛔**DO NOT STORE THE BEHIND-BY NUMBER — it decays silently.** I wrote `behind 4`; the triager
  re-measured **`behind 5`** ~1h later (master gained `d2b405d31`/#12252), and I confirmed. Branch base
  is `ca76f8781a`, so behind-by == `git log --oneline 72b528b42d..origin/master | wc -l` and increments
  on **every** master merge, touching nothing in the PR. ⇒ **quote the COMMAND, never the count.**
  ⭐⭐⭐**Behind-by is a two-sided figure: it moves when the OTHER side moves, so "I verified it" has a
  shelf life measured in merges, not hours** — same family as `updated_at`-vs-`state_reason`.
  ⚠️Not a code signal at all: `BEHIND` here is branch staleness + required-check bookkeeping.
- **Touched files: exactly 2** — `source/slang/slang-ir-simplify-cfg.cpp` +
  `tests/language-feature/error-handling/catch-interface-typed.slang`. **Zero sccp files.**
- ⛔**GitHub reviews on #12348: `0`.** `reviewRequests: [jkwak-work]`, 0 PR comments, 0 issue-comments.
  ⇒ the triager's *"reviewer APPROVE_WITH_NITS"* is an **internal reviewer-coworker verdict, NOT a
  GitHub review state.** Do not index it as an approval and never quote it upward as one.
  ⭐⭐**A local pipeline verdict and a GitHub review state are different artifacts with the same
  vocabulary** — `APPROVE_WITH_NITS` is not in GitHub's enum at all.
- Issue has **2 nv-slang-bot comments** (`triage: reproduced and root-caused` 16:54Z; `fix in draft PR
  #12348, held pending review` 19:49Z) ⇒ the draft-held-PR GitHub-observability obligation **is met**.

## ⛔ #12361 does NOT share a producer — REFUTED BY MEASUREMENT, not argument

I hypothesized a shared producer with [[project_12361_catchall_direct_throw_sccp_param_ice]]. The
triager **tested it instead of reasoning about it**, and the timing gave a clean experiment: master
HEAD is now `19d1d4065` == #12361's reporter SHA, while #12348 is still unmerged, so both states
existed in one afternoon.

| | pristine `19d1d4065` | with #12348 (`72b528b42`) |
|---|---|---|
| #12343 repro | hang (124) | **0 — fixed** |
| #12361 repro | ICE 255 `sccp.cpp(1289): param` | **ICE 255, byte-identical** |
| #12361 via-function control | 0 (compiles) | — |

⇒ **different passes (CFG block-merge vs SCCP); #12361 will still be open after #12348 merges.**
They share a **trigger surface** — both need a `throw` in a `do{}` with a handler, so both reach the
catch-lowering shape where `successor` still holds a param at merge time — **not a cause.**
⭐⭐⭐**A shared trigger surface is the most seductive false-dup signal: same author, same week, same
subsystem, adjacent line numbers. Only a two-state differential experiment separates them** — and it
was available only because the fix was unmerged *and* HEAD happened to equal the second reporter's SHA.
⭐⭐**My hypothesis was cheap to state and would have been expensive to act on** (treating them as one
leaves #12361 unfixed). The triager's move — run it, don't argue it — is the standard.

## RESUME / CO-TRIGGER

**RESUME = PR #12348 merges** → re-read the merged diff → refresh verdict comment `5182114414` to
"fixed, merged in #12348" → forward final `[Triage Resolution]`. Otherwise: a fresh substantive human
comment. ⚠️It is a **draft with 0 GitHub reviews and diverged 4 behind** — a merge needs jkwak-work's
review *and* a ready-flip, so this is further from landing than "APPROVE_WITH_NITS" suggests.

Related: [[project_12361_catchall_direct_throw_sccp_param_ice]] (adjacent, separate cause),
[[project_12330_entrypoint_throws_not_diagnosed]], [[feedback_delivered_artifact_missing_index_row]].
