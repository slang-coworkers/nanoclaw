---
type: chain
title: slang#14055 — parser takes `a * *p` (multiply by a dereferenced pointer) as a pointer type
description: Human-filed (albertrodriguezclo, cloth-sim batch) 2026-10-29 21:51:29Z. Regression from #6627 (v2025.6.3), frontend/parser, P1. Fix A is done locally by slang-fixer and unpushed (R6); the triager posts and the fixer opens a draft PR after 2026-11-02 21:51:29Z. Side finds live in their own records.
tags: [parser, pointers, r6]
---

# slang#14055 — `3 * *p` parse failure

**Ask.** `int r0 = 3 * *p;`, `a * *p`, and `*q += 3 * *p;` fail on every target with E20001
("unexpected identifier, expected ';'") + E30060 ("expected a type, got 'int'"). The parser reads
`3 * *` as the start of a pointer type. `3 * (*p)` works. Reporter is on master 43ac12323.

Side finds of this chain: [[14078-pointer-emit-pr-stack.md]] (#14078/#14082/#14084/#14087, each with a
draft PR) and [[14086-14089-pointer-semantics-parked.md]] (#14086/#14089, parked on maintainers).

## State (10-30 06:0xZ)

| item | state |
|---|---|
| GitHub | no labels, 0 comments. **R6 hold: no bot comment, push, commit or PR naming #14055 before 2026-11-02 21:51:29Z** (human-filed, fence but no crash word, no `bot-ok`) |
| Fix | `fix/issue-14055`, 2 commits on 977df1246, unpushed; the commit messages do not mention #14055 |
| Triager timer | `t-766555` 11-02 21:52Z: posts the 5-bullet, adds `reproduced` + `regression` + Type=Bug (P1, so no P2 rationale) |
| Fixer timer | `slang-14055-r6-push-2eff` 11-02 22:00Z: pushes and opens the draft PR |
| Stand-down (both) | a human comment (the reporter counts), an assignee, a human/draft PR, a cross-ref/`connected` link, GoodFirstBug/HelpWanted/no-bot, or a fetch error |

To audit a timer: `ncl sessions list --thread-id system:tasks:<series>` (a `[]` does not prove absence).
Triager owner session: `1k60r3` (pin with `in_reply_to=2`).

## Triage (10-29 22:09Z; the triager's figures, not re-run by me)

Regression, medium, frontend/parser, P1 (P2 defensible: 19 months old, parentheses work around it). No
duplicate; the sibling is #6684 / PR #6686. A, B, C fail on HEAD 977df124 on all 6 targets; v2025.6.2
compiles them (OpIMul), v2025.6.3 fails. The only parser commit between is 4eb7a27ac (#6627, 2025-03-19),
confirmed by blame.

**Root cause.** The `OpMul` case at `slang-parser.cpp:9637` in the type-follower lookahead of
`parsePostfixExpr` (9622-9645), so `x * *` always becomes `Ptr<Ptr<x>>`. It exists because generic args go
through the expression grammar (`_parseGenericArg` → `ParseArgExpr`), so `RWStructuredBuffer<int**>`
(tests/metal/pointer-in-buffer-rwbuf-alias.slang:14), `bit_cast<int**>` and `sizeof(int**)` need it.
**Fix A:** skip the run of `*`, then apply the existing follow set; only rejected programs change, so
`pr: non-breaking`. B (literal-only) misses form B; C (semantic) is heavier; D (delete `OpMul`) is ruled out.
Memo: `/workspace/inbox/a2a-1793311742182-wch6ym/triage-14055.md`.

## Local fix (10-30 00:29Z; the fixer's figures via the triager)

Two corrections to fix A: (1) `EndOfFile` stays a type follower, because `findTypeByName("int**")` goes
through `parseTermString` (unit test added); (2) with ≥2 `*` before `(` the type reading stays
(`int**(pp)` compiles on master), so `a * *(p + 1)` is still rejected; the queued comment states this limit.
New `tests/language-feature/pointer/multiply-by-deref.slang` passes on cpu/vk/cuda and fails on master.
Main's acceptance checks hold: `int** pp = …;` declarations and `(int**)` casts still parse as types (decl /
declglobal baselines unchanged, with a `ParseStatement`→`ParseType` trace). Full suite 11304/11307 (3
`fp8-cuda*`, pre-existing, as #14037). Codex approved plan and code.

## Decisions (Main)

- **10-29, #14037 pattern:** hand off now, fix A local-only; triager posts after the lift, fixer pushes after.
- **10-30, #13435 precedent for side finds:** the triager dedups each and files only non-duplicates as bot
  issues, with **no #14055 reference before the R6 lift** (a cross-ref is a timeline event). Their
  `issue_opened` webhooks are owned from this chain and need no dispatch.
- **10-30 ~05:00Z fan-out question** (dashboard msg 129, 7-row table): 6 bot issues and 3 drafts (#14090 followed) — keep
  filing deduped side finds, or cap? **Default until answered: HOLD new filings.** The triager keeps a held
  list (`memory/scratch/held-side-finds-14055-chain.md` in its group); all 5 fixer sessions were told.

## Side finds that needed no new issue

- HLSL E99999 → dup #13632 (draft PR #13856 E55219, and #13652, both unmerged).
- SPIR-V `__getAddress` OpStore mismatch → dup #13418 (bot, assigned jhelferty-nv, awaiting_human). Main OK'd
  ONE comment with 3 more shapes (a `RWStructuredBuffer<int*>` element, a local `int* p` then `buf[0] = p`,
  `*out = …` through `uniform int**`); relayed 00:53Z to triager owner `sess-1793273625935-bb46pw`, pinned
  `in_reply_to=2`, landed at its seq 6.
- WGSL hang → dup #12498. Trigger: a non-entry helper that *returns one of its pointer params* (`return x;`,
  `c ? a : b`; `return x + i;` finishes). v2025.18.2 OK, v2025.19+ hangs, exposed by #8668 (e420f2f98,
  `specializeAddressSpaceForWGSL`); `newWorkList` at slang-ir-specialize-address-space.cpp:700 is never
  cleared. Posted 00:56Z (comment 6512223455), pointing at open PR #13151 by jvepsalainen-nv ("Reset
  address-space fixpoint worklist each round", idle since 10-09). Stalled bot PR #12563 was not split.

## Held list (not filed; the operator decides)

1. render-test ignores `-entry` (`tools/render-test/options.cpp:301-303` parses it; `slang-support.cpp:22,802`
   hard-codes computeMain). All 194 `-entry` rows (66 files) use `computeMain`, so none is vacuous today; the
   trap hits only new rows with another name (it hit #14080 R1 G1).
2. Direct SPIR-V zero-extends a narrow signed `CastIntToPtr` — marked not-to-file.
3. GLSL `bit_cast<uintptr_t/intptr_t>(double)` → E99999 (no IntPtr/UIntPtr arm in the #14084 switch; SPIR-V
   siblings #8480/PR #13201, #13200/PR #13202). A natural extension of #14085 if allowed.
4. Direct SPIR-V null Workgroup ptr → `processPtrLit` (spirv-legalize:2122) → `OpConvertUToPtr`, rejected by
   spirv-val, with or without `-g`; a logical null needs `OpConstantNull`.
5. `*(int*)(v + 1)` on a `uniform void* v`, direct SPIR-V, SIGSEGVs the Vulkan test server (spirv-val
   accepts; driver or render-test suspected).

## Lessons

- `ncl sessions messages` on a RUNNING session shows only `out` rows. Infer delivery from `last_active`
  moving with no new session minted, then confirm by the peer's ack.
- Fixer reports on this chain drift to Main (01:54Z, 04:09Z, 04:53Z, 05:50Z, 06:01Z): forward each to the
  triager rather than acting on it.

## Next

The 11-02 timers; then the triager sends the [Triage Resolution] when the PR opens.
