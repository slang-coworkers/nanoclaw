---
type: chain
title: "slang#13544: C++14 ' digit separators in numeric literals"
description: "Feature request from an external reporter, unassigned. Triaged P3, frontend lexer + preprocessor. GO on (1) a separate #if literal-decoding bug (filed as #13545) and (2) finishing _ for floats, both as drafts: PRs #13546 / #13547, CI gated on a falcor-ci approval. ' (3) is HELD on a maintainer/spec decision. Re-chase rechase-13544-sep-271e on 2026-10-12."
---

# slang#13544: `'` digit separators

**Origin.** damster101 (NONE, external) filed this on 2026-10-09 at 15:26Z. Nobody is assigned. I routed it to
slang-triager on `gh-issue-shader-slang/slang-13544` after a live read showed it open, with 0 comments and a body
matching the payload.

**Triage (slang-triager, 16:06Z).** Comment
[6084601764](https://github.com/shader-slang/slang/issues/13544#issuecomment-6084601764). Feature, P3, low, frontend.
No labels were added, and no duplicate was found. Findings are from master ae6d69935:
- The spec (lexical-structure.md:98) allows `_` in integer literals and says nothing about `'`. Its float section is
  incomplete.
- `_` works for integers. It is rejected in floats: `1_000.5f` gives E20001, and `1.000_5f` / `1e1_0` give E39999.
- `'` always starts a char literal, so `1'000` gives 10005 / E20001.
- **Pre-existing bug:** `#if` decodes integers with `stringToInt`/strtoll (`slang-preprocessor.cpp:3029`). I
  reproduced this myself on the local Release build: `#if 1_000 == 1` is true, while `#if 0b101 == 5` and
  `#if 0X10 == 16` are false. It is the same on 2025.23.2.
- The reporter's clang-format reason did not reproduce with 17.0.6: `_` is fine, and `'` breaks only under
  Standard ≤ c++11. The triager asked the reporter for their version and config.

**Disposition (orchestrator, 2026-10-09 ~16:15Z).** This uses the standing proactive authority, drafts only.
- (1) The `#if` bug gets its own issue, filed by the triager as "found while triaging #13544". The filing must not
  claim a maintainer asked for it, since none did. The fix goes in a draft PR on that issue.
- (2) Finishing `_` for float literals goes in a draft PR on #13544, marked "Part of", not "Fixes". Floats copy the
  integer `_` rule, and any placement question goes in the PR body.
- (3) `'` is HELD on a maintainer/spec decision. The decision is a grant or refusal plus a placement rule. Read the
  polarity of the comment body before acting.

**16:15Z, #13545 filed (I checked it live).** Bot author, Type=Bug, `reproduced`. The body opens "Found while triaging #13544"
and claims no maintainer ask. The triager released slang-fixer (triager msg 13) for PR1 `fix/issue-13545` (`Fixes #13545`) and PR2
`fix/issue-13544-float-sep` (`Part of #13544`), both drafts. The triager posts the 5-bullets once the PR numbers exist.

**16:15Z, #13545 `issue_opened` webhook (Main session sess-1791562535049-336qy7).** It's our own filing echoing back, so I
dispatched nothing. The owner is the #13544 chain: the fixer acked the GO at 16:16:56Z and both builds had started by 16:18Z. I extended
`rechase-13544-sep-271e` step 1 to also read non-bot comments on #13545.

**17:15Z, two scope calls from the triager (I re-checked both on the ae6d69935 Release build).**
- PR2 changes integer behavior. Today `0b1_2` gives 4 and `07_9` gives 65, both with rc 0, a silent miscompile; `0b12` gets E10003.
  Accepting `_` in `_lexDigits` makes both an E10003 error. **Accepted:** the change is disclosed and comes with a DIAGNOSTIC_TEST and the
  `pr: breaking change` label (precedent #13429, a merged `breaking change`). It is not silent, so the "don't silently change integers"
  rule holds.
- `#if (-2147483647 - 1) / -1` and `% -1` crash slangc on master (SIGFPE, rc 136). The fix goes in PR1 as a separate commit. **No new
  issue:** the repro and the "also fixes" note go into PR1's body and into the #13545 5-bullet, so a crash on master stays on the record
  even if the draft stalls.

**18:53Z, both drafts open (I checked them live).**
- **#13546** `fix/issue-13545` `b3abc96b59`, `Fixes #13545`, breaking. It includes the SIGFPE guard commit, and the body has the crash repro.
- **#13547** `fix/issue-13544-float-sep` `1d2b298a91`, `Part of #13544`, breaking. Open question: tighter `_` placement.
- Both are bot-authored drafts, mapped to slang-fixer `sess-1791561994184-c25n6k`.
- The 5-bullets are posted: #13545 cmt 6087251913 (has the SIGFPE/136 repro) and #13544 cmt 6084601764 (edited).
- CI runs 37975185721 / 37975188823 are `waiting` on the **falcor-ci** environment (reviewers `ci-approvers`, current_user_can_approve=false).
  They are not queued: this is the same gate as #13436 and needs an operator/ci-approver approval. I told the operator.

**10-10 01:58Z, [Triage Resolution] for PR2 #13547 (I checked it live at ~02:00Z).** It's still a draft. Head `6c65eea6c4`, 8 files, +212/−13,
`Part of #13544` with no closing keyword. slang-reviewer R2 gave APPROVE_WITH_NITS (nits applied). Left in the PR body for the maintainer: tightening
`_` placement (`1._5`, `1e_5`, `1.5_`) and the `0b1_2`/`07_9` → E10003 break.
- github-actions **auto-assigned maintainers** at 18:54:45Z, a minute after the triager's 18:53 "no reviewers" note: #13547 → skiminki-nv
  (assignee + review request), #13546 → jkwak-work. Neither has reviewed yet.
- CI: the 18:5xZ runs 37975185721/37975188823 were **cancelled** (superseded). PR2's new run 38014317927 (01:44Z, at head) is `waiting` on
  falcor-ci (can_approve=false). The triager called this the "draft gate"; it is the falcor-ci environment.
- PR1 #13546 is at head `911a570b41`, reviewer round 3. Its resolution will follow on the thread.
- There are no human comments on #13544 or #13545.
- The "passing" pull_request_target runs on both heads are only **PR Maintenance** (38014947453 / 38014940407), not a code check. The
  draft `pull_request` CI is `skipped`. **PR1 #13546 has no CI run at all at head 911a570b41:** its earlier dispatch was cancelled and
  nothing was re-dispatched as of 02:0xZ. The fixer is expected to dispatch it after round 3. Dashboard msg 51 calls the PR Maintenance
  runs "lighter checks"; next time, call them what they are.

**Resume.** `rechase-13544-sep-271e` (2026-10-12T16:00Z).
