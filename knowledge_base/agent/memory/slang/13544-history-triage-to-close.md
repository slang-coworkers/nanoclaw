---
type: chain
title: "slang#13544 digit separators — history, triage → reporter close (10-09 → 10-16)"
description: "Settled history of #13544: triage findings, the three-part disposition, #13545 filing and the two drafts, the 10-12 maintainer comments (skiminki-nv deferral, tangent-vector's refusal of '), 10-13 float-_ suggestion and pointer reply, reporter close, and the final 10-16 re-chase. Live state is in [[slang/13544-digit-separators.md]]."
tags: [slang, frontend, lexer, preprocessor, history]
---

# slang#13544: history, triage → close

Split out of [[slang/13544-digit-separators.md]] on 2026-10-16 to keep it under the 16k cap.

## Triage (10-09 16:06Z, comment 6084601764, master ae6d69935)

Feature, P3, frontend; no duplicate. `_` works for integers but floats reject it (`1_000.5f` → E20001, `1.000_5f` /
`1e1_0` → E39999). `'` always starts a char literal (`1'000` → 10005 / E20001). Pre-existing bug: `#if` decodes integers
with `stringToInt`/strtoll (`slang-preprocessor.cpp:3029`), so `#if 1_000 == 1` is true and `#if 0b101 == 5` /
`#if 0X10 == 16` are false (also on 2025.23.2). The reporter's clang-format reason did not reproduce with 17.0.6.

## Disposition (10-09 ~16:15Z, proactive authority, drafts only)

1. The `#if` bug filed separately as **#13545** ("found while triaging #13544", no maintainer-ask claim) → draft
   **#13546** (`fix/issue-13545`, `Fixes #13545`).
2. Float `_` → draft **#13547** (`fix/issue-13544-float-sep`, `Part of #13544`).
3. `'` HELD on a maintainer decision.

Scope calls at 17:15Z (re-measured): accepting `_` in `_lexDigits` turns today's silent `0b1_2` → 4 and `07_9` → 65
into E10003, so #13547 is labelled `pr: breaking change` with a DIAGNOSTIC_TEST (precedent #13429). `#if (-2147483647 -
1) / -1` and `% -1` SIGFPE slangc (rc 136); the guard went into #13546 as its own commit, no new issue. Both drafts
opened 18:53Z, mapped to slang-fixer `sess-1791561994184-c25n6k`; github-actions auto-assigned skiminki-nv (#13547) and
jkwak-work (#13546). CI dispatches wait on the **falcor-ci** environment (`ci-approvers`, current_user_can_approve=false),
the same gate as #13436. The "passing" pull_request_target runs are only **PR Maintenance**, not a code check — call them
that, not "lighter checks".

## Maintainer rounds

- **10-12 09:34–09:39Z, skiminki-nv:** 6121589625 says the spec `_` text is non-normative and defers the character /
  placement / version decision to tangent-vector (deferral, not a decision); 6121612803 marks #13547 **blocked**;
  6121664877 calls `0b1_2`/`07_9` acceptance "a lexer bug". Their premise that separators sit only between digits was
  wrong as measured: `123_`, `1__0`, `0x_FF` all compile today, and `slang-lexer.cpp:703` has a TODO to decide separator
  characters. Our own "spec already allows `_`" overstated a non-normative page. The triager's single reply 6121884514
  corrected that and offered (as a question) to split out the invalid-digit fix — never answered, so not a request.
- **10-12 18:33Z, tangent-vector** 6130273967: *"My strong preference would be to close this issue, since `_` as a digit
  separator is already supported."* ⇒ refusal of `'`; (3) terminal. I asked the operator CLOSE/KEEP/NARROW for #13547.
- **10-13 07:51Z, skiminki-nv** agreed (6140927891) and suggested float `_` (6140951497, `1_23.3` → E20001) — exactly
  #13547's scope. The triager's one authorized pointer 6141277564 showed the snippet at `6c65eea6c4` vs master and listed
  the open questions (placement `1._5`/`1e_5`/`1.5_`; E10003). The operator ask was superseded.
- **10-13 09:07Z, damster101 closed #13544** (completed): *"It is better to have only one way to separate digits."*

## Final re-chase (10-16 16:00Z, `rechase-13544-tv-6b49`)

No new comments, reviews or timeline events on #13544–#13547 since 10-12 18:34Z. Falcor-ci runs 38010557763 /
38014317927 still `waiting`. The operator never answered the 10-12 ask (dashboard row 499492), treated as KEEP. One
5-bullet to the dashboard; no further re-chase.

Side note from 10-13: the triager's `wt-13555` worktree `build/` held `6c65eea` binaries — rebuild before measuring
#13555 there (a round was once rejected for citing a binary from the wrong SHA).
