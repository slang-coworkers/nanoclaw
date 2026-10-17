---
type: chain
title: slang PR #13406 (#13339 Ref split) — review-round history, 2026-10-01 → 10-11
description: Settled history of the ParameterPassingMode Ref-split PR #13406 that #11709 is held on — tangent-vector's round, jhelferty-nv's readonly rounds and reversal, the effective-mode settlement, round 3 + the GCC/FIDDLE split to #13570, and the 10-09 owner-budget/phantom-session/misrouted-webhook incident. Distilled 2026-10-13; live state is in [[slang/11709-groupshared-param-by-reference.md]].
tags: [slang, frontend, param-passing-mode, history]
---

# PR #13406 (#13339 Ref split): review-round history

Split out of [[slang/11709-groupshared-param-by-reference.md]] on 2026-10-09 and distilled 2026-10-13. The **live**
state (head, owner session, timer `rechase-13406-r6-a54e`) is in the parent; this file records how the design converged.

## Opening and tangent-vector round (10-01 → 10-05)

- slang-fixer pushed `fix/issue-13339-ref-access-modes` (`7131985de3`); its own PLAN_REVIEW blocked the draft (Codex
  R5: on master `const groupshared` has nothing to map). I refused to route around that gate via the operator; one
  verified #13339 comment gave jhelferty-nv the blast radius instead. Draft **#13406** opened 10-02 17:46Z
  (`66523f1b33`, `pr: breaking change`), 5-bullet [5958125514](https://github.com/shader-slang/slang/issues/13339#issuecomment-5958125514).
- tangent-vector: 8 inlines then APPROVED (5395294814) — **auto-dismissed 25 min later by the next push**, which the
  fixer still reported as "approved". He sharply objected to the bot rewording his doc comment; reverted byte-for-byte.
  His `RefParam<T,A>`-vs-separate-types question (r4168522180) was settled by jhelferty-nv on 10-09 (below).
- slang-reviewer must-fix: `RefParam<float,(Access)7>` hit E99997 (master: E39999) → new diagnostic rejecting an
  invalid constant access, held in a 4-commit batch. On 10-05 jhelferty-nv flipped ready (dshreiner-nv requested and
  removed 28 s later); with no approval left to dismiss I had the batch pushed (`0adba88fd1`). She asked for a renumber
  (collision with master): E30032 → **E30034**, head `a1286c3415`.
- ⇒ Every push dismisses an approval, so batch changes into one push.

## jhelferty-nv `readonly` rounds and the reversal (10-06 → 10-09)

- 10-06 CHANGES_REQUESTED (5431819390): `readonly` + `__ref` → `RefReadOnly` via a declaration-level
  `ReadOnlyModifier` ([r4198094764](https://github.com/shader-slang/slang/pull/13406#discussion_r4198094764)); witness
  synthesis adds `ReadOnlyModifier`, not `ConstModifier`. She chose "parse first" over late resolution
  ([r4201706513](https://github.com/shader-slang/slang/pull/13406#discussion_r4201706513)). Master merged at her request
  10-07 (no force-push); **#13232 on master caused all 7 conflicts** and the split moved into its shared helpers.
- **Reversal, 10-08 22:10Z (review 5463447838):** `readonly`/`writeonly` stay GLSL memory qualifiers; new keywords
  `__ref_readonly`/`__ref_writeonly`; the three modes stay distinct in overload matching; reading through
  `__ref_writeonly` is an error ([6070683551](https://github.com/shader-slang/slang/pull/13406#issuecomment-6070683551)).
  Found while implementing: master mangles every Ref as `r_` (`slang-mangle.cpp:137`), so witnesses collided.
- **10-09 02:33Z answers (5465076473):** append `Access.WriteOnly = 3`, used only as `RefParam`'s access (no separate
  param types; reject `Ptr`/`Ref<T, Access.WriteOnly>`); mangling `r_`/`ro_`/`wo_` with `__ref` staying `r_`; value reads
  of `__ref_writeonly` are E30119, checked in `coerce()`. r5 pushed as `4e2603652e` with five questions back to her.
- **10-09 14:06Z (5471154778):** the read check keys off `Access.WriteOnly`; GLSL `writeonly` returns to master's E30119
  scope (initializer/assignment RHS only); `__ref_writeonly` → `inout` is E30119; keep E30035; only `out` and
  `__ref_writeonly` count as a location; dropping a restriction is rejected both ways, `__ref` may go to either
  restricted mode; the `t.Load()` gap is accepted.
- **Effective-mode settlement, 10-09 18:15–19:03Z.** tangent-vector (6086673678): "Don't rewrite things" — compute the
  effective parameter-passing mode in one place, every consumer queries it, handle `const __ref` there, and say
  "memory location", not a bare "location". This conflicted with 5463447838's `ConstModifier` rewrite; jhelferty-nv
  deferred to him (6087420482). Result: no rewrite; the effective mode maps `RefModifier`+`ConstModifier`/
  `ReadOnlyModifier` → `RefReadOnly`.

## Round 3 and the GCC/FIDDLE split (10-10 → 10-11)

- **Round 3 `7e683a211b`** (10-10 05:52Z, FF of 3 commits on `4e2603652e`, 29 files +985/−150, reply 6094384572, no
  pings): her 14:06Z items, the effective mode, and slang-reviewer round-2 items. Read check via
  `QualType::isWriteOnlyRef`; GLSL `writeonly` output byte-identical to master. Terminology grep clean.
- Required **`SlangPy Tests` went red**: FIDDLE-generated code in `slang-serialize-ast.cpp` mis-expanded
  (`slang-ast-type.h.fiddle:702`). Fixer's diagnosis, reproduced with GCC 13.3: **GCC PR108900** — past 0x50000000
  source locations an `#include` at the crossing resumes one line short, so `__LINE__`-keyed FIDDLE expands another
  header's body; round 3's header growth moved the crossing onto `slang-serialize-ast.cpp:5`. Fix: `-flarge-source-files`
  for GCC in `cmake/CompilerFlags.cmake` (`c2e65635c2`); SlangPy green. slang-reviewer independently verified the
  PR108900 backports (r14-11679 + r14-11749, before 14.3). The bug can hit master's other TUs as headers grow.
- jhelferty-nv asked for "a separate PR" (6098823701) → draft **#13570** (`fix/gcc-flarge-source-files`, only
  `cmake/CompilerFlags.cmake` +11, `pr: non-breaking`, mapped to `dth1ak`), slang-reviewer APPROVE_WITH_NITS, nits in
  `bffd07cc1b`. #13406 forward-reverted the flag (`2781df933e`, tree == `7e683a211b`), so **SlangPy is red on #13406 by
  design until #13570 merges and #13406 merges master.** The 15:02Z relay sat 9 h unanswered until tick 275's pinned
  nudge (see [[orchestrator/supervise-tick-blind-spots.md]] #3).
- **My error:** I told the fixer round 3 "deletes the FIDDLE() classes `ReadOnlyModifier`/`WriteOnlyModifier`" — false
  (both at `slang-ast-modifier.h:401/410`); I had diffed against a `FETCH_HEAD` a later fetch overwrote. The fixer
  caught it. Rule: [[imported/feedback_quarantine_the_tree_not_the_one_symptom.md]] (never diff against `FETCH_HEAD`).
- Also caught by slang-reviewer: Reviewer A claimed "CI green" when every ci.yml job was skipped behind
  `wait-for-human-priority`. A skip-everything run is not evidence.

## 10-09 owner-budget, phantom-session and misrouted-webhook incident

- Owner `jylfb4` ran R16–R20 in a subagent to $288/$300 and hit the SDK limit at 03:46Z. Cost-cap read `escalated`,
  never `stopped`, so the `stopped`-gated watcher (`tools/gate-jylfb4-stopped.sh`) could never fire; cancelled. Work
  resumed in `dth1ak` on `…-11709/13406-resume` with 7 clean local commits.
- Phantom `sess-1791471057196-2ouns9` (thread `…-12122`) was minted by my `in_reply_to` reply: the owner stamps reports
  `…-12122` but lives on `…-11709`, the D1 cross-thread guard rejected the reply, and the fall-through created a new
  session. It called the reversal "lost", began redoing it, then stood down with no edits; its advisory was forwarded
  pinned to `jylfb4`.
- Because remap `appr-…iwgn54` stayed pending, every maintainer webhook (14:06Z review, 15:24Z "poke", tangent-vector
  18:15Z, the 10-10 split ask) reached `jylfb4`, whose ceiling someone else raised to $400. It posted only accurate
  status replies/acks and touched no code; I relayed each text verbatim, pinned, to `dth1ak` and never replied to `jylfb4`.

## #13570 lands, #13406 goes green (10-13)

- jhelferty-nv merged master into #13570, readied it (19:47Z), and merged it at 22:16Z as `7d7ad3bbfe` after jkwak-work
  APPROVED (5509318075, noting build memory and time cost). The "un-draft is the operator's call" gate was overtaken.
- The dashboard Orchestrator session had sibling slang-fixer session `3xpxb6` merge master into #13406 →
  `7c962f27a7` (no force-push, no conflicts), and SlangPy went green, confirming the PR108900 split. The PR's own diff is
  unchanged, and her CHANGES_REQUESTED is untouched.

## 2026-10-15 08:15Z: jhelferty-nv took over #13406 (checked live)

- She assigned the PR to herself and retitled it "Split the Ref passing mode by access", with the `pr: breaking change` label. From 10-14 15:05Z to 10-15 06:18Z she pushed **13 commits** of her own: `bfa609502c` … `671215f5de`, the last one a master merge.
- Her commits include: stop reflecting readonly ref as const; write-only ref is not an entry-point output; inlay hints and signatures from the effective mode; accept a read-only memory location as a `__ref_readonly` argument; drop tests for behavior no longer touched; **defer the `__ref_writeonly` read check to a follow-up and require `-experimental-feature` for `__ref_writeonly`**; spell the modes as `ref readonly` / `ref writeonly`.
- She posted no comments or review threads, and her CHANGES_REQUESTED review is still sticky. At her head, `check-ci` and the falcor gate are SUCCESS (babysitter, 08:05Z).
- I told the owner `dth1ak` to stand down (msg 2591). It should not push unless she asks, and should read her head before replying to any webhook. Its worktree is stale.
- **#11709 hold:** still lifts when #13406 merges. Her renamed spellings (`ref readonly`) and the deferred write-only check change what #11709's rebase must target. Re-read her final head at that point.
- 10-15 09:31Z: slang-reviewer's round-3 verdict on `7e683a211b` arrived late: REQUEST_CHANGES (small). R1: `__ref_readonly`→`__ref_readonly` forwarding gives E30047. R2: inlay hints at `slang-language-server-inlay-hints.cpp:77` still read `RefModifier`. jhelferty-nv's head supersedes it; her `e7ce4ae5ff` and `e0c41e64a2` look like R1 and R2, though the reviewer judged only from the titles. `dth1ak` closed it as not actionable and stood the reviewer down. No fresh review at her head. Her deferral of the write-only read check reverses her own earlier "every read is an error" ruling. That's her call as the maintainer, but #11709's rebase must not assume the old rule.
- 10-15 10:00Z: the remap `appr-1791517835370-iwgn54` was approved and executed, and #13406 now maps to `dth1ak`. It changed nothing, because the mapping already pointed there (previous = current). **#11709 still maps to `jylfb4`**, the old session that was out of budget. When the #11709 hold lifts, route that work to whichever session owns it then; don't assume `jylfb4` can act.
- **10-16 20:59Z: jhelferty-nv posted "@nv-slang-bot stand down" on #13406** (issuecomment-6224584448). I checked live: the bot's last activity on #13406 was the 10-11 00:26Z comment pointing to #13570 (its last review and inline comment were 10-07). Nothing has posted since she took the PR over on 10-14. Her stand-down is a standing instruction and covers every bot tier, not just the fixer. tangent-vector's three new inline threads (r4299278921/287906/294079, 20:57–20:59Z) are addressed to her; the bot doesn't answer them. `dth1ak` acknowledged and stood down (no reply, review or push). Other bot sessions tied to #13406 that must not post: slang-fixer `3xpxb6` (the 10-13 master merge), slang-reviewer `htd20q` and `rhmzor`. **#11709 is still held until #13406 merges.** When it lifts, re-read her stand-down before any bot action there too, because #11709 is a different PR and her instruction was on #13406.
