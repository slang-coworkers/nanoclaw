---
type: chain-log
title: slang#14053 — dated history
description: Dated readings of the #14053 chain (10-29 triage and the retired R6 hold, 11-02 comment + Approach C handoff, draft PR #14221 and its 3 review rounds, side issues #14228/#14229/#14230, 11-05 r1 re-chase and master merge); current state lives in the chain record, new dated entries append here
---

# slang#14053 — dated history

Chain record (bug, cause, current state, binding decisions, do-not-dispatch list): [[slang/14053-overloaded-entry-points-same-name.md]].
New dated entries go **here**, one `###` entry under its day's `##` heading. When this file nears 16 KB, prune the oldest superseded entries.
Numbers are the coworker's own unless marked verified.

## 2026-10-29

### 10-29: filing, triage, and the (retired) R6 hold

- GitHub at 21:5xZ: 0 comments, no labels, no assignee. `grep 14053 memory/` had no hits, so it was not a follow-up of any chain.
- Triage by slang-triager 22:14Z (memo `/workspace/inbox/a2a-1793312045725-4wby3h/triage-14053.md`); Main verified Type=Bug + `reproduced` 22:1xZ. The reporter has ≥10 open self-PRs (#13930–#14022).
- Main 22:1xZ held the fixer until the 4-day R6 window elapsed (#14033 precedent), via the triager one-shot `i14053-r6-post-b43c` (11-02 22:00Z: stand down on a reporter/human PR, follow a maintainer reply, else post the 5-bullet and hand Approach C to slang-fixer, citing #13882). ⛔ That hold rule is retired (Core Memory R6 line); do not copy it.

## 2026-11-02

### 11-02 22:06Z: re-check fired; comment posted, Approach C handed to slang-fixer

- These are the triager's checks: no newcomer label, no PR referencing #14053, no comments. jkwak-work was assigned by jhelferty-nv at 18:39:46Z.
  That is a shepherd assignment, and under the sibling Main rule (recorded in [14055](14055-parser-multiply-deref-pointer.md), 11-02 ~21:5xZ) it is not a stand-down.
- Verified by Main: bot comment [6589648302](https://github.com/shader-slang/slang/issues/14053#issuecomment-6589648302)
  (22:05:56Z, the only comment, no @-mentions). It offers the draft PR ("the assignee may take it over or close it") and the default-value split for maintainers.
  slang-fixer session `sess-1793657193763-f9uw61` is on the canonical thread (created 22:06Z).
- **Overlap:** reporter PR #14147 (fixes #14137, not this issue) restructures `findFunctionDeclByName`: E38000 moves to
  `findAndValidateEntryPoint` and the lookup runs on a temp sink. Our `-entry` ambiguity error touches the same hunks.
  The fixer bases on master and notes the overlap; whichever merges second rebases.
- **Default-value warning:** NOT filed. It is a reporter scope/diagnostic ask, not a verified bug, so the 10-31 filing rule's
  "ask" branch applies. The comment leaves it to maintainers; file only on maintainer request.
- Next: the fixer's draft PR → triager [Triage Resolution].

## 2026-11-03

### 11-03 01:29Z: draft PR #14221

Bot DRAFT PR #14221 "Report entry points that share a name in one output, and ambiguous -entry names". Head `fix/issue-14053` @5c7e82507, label `pr: non-breaking`.
The pr-mapping goes to fixer `sess-1793657193763-f9uw61` (verified). The fixer reports 8 new tests and a full suite run on Debug; I have not re-run them.
The [Fix Review Request] went to slang-reviewer, and the fixer sends its [Fix Report] after the review. Un-draft needs operator sign-off (as with the other bot drafts).

### 11-03 03:2xZ: review round 1, and the default-value ask is reversed to "file"

- These are the fixer's figures. Round 1 was REQUEST_CHANGES: a false E38016 on HostVM and 4 test gaps. The fix is applied; head 76f7f27. Tests: 30/30 PR, 3366/3366 subset, 663/663 unit. Round 2 review is pending.
- **Reversal.** `Fixes #14053` would close the issue and leave the default-value ask untracked. The fixer saw this, but its 03:16Z relay to the triager
  was addressed to the CLOSED task session `sess-1793312005412-mnoqvo` (`i14053-r6-post-b43c`) and never reached a live triager session.
  Main now authorizes filing under the 10-31 rule: reproduced, deduped, a silent no-op of the same class as #14053.
  Sent to triager thread session `sess-1793310892824-ykqeww` (msg 63, in_reply_to=16): file it "Split from #14053", edit comment 6589648302 in place, report the #. No fixer.
  Sent to fixer (msg 61): once the # exists, add a "tracked separately in #N" line to the #14221 description.
- ⚠️ Lesson: a peer reply that is threaded to a one-shot task's session dies with that session. Re-dispatch it to the canonical thread session.

### 11-03 03:30Z: side-ask filed as #14228 (filed-only, no fixer)

- Bot-filed #14228, "A default value on an entry-point parameter is accepted with no diagnostic, but the generated kernel ignores it".
  It was filed 03:29:22Z with `reproduced`. I verified it says "Split from #14053" and has no @-mentions.
  Comment 6589648302 was edited at 03:29:42Z and now says "tracked in #14228" (verified).
- **The #14228 `issue_opened` webhook belongs to THIS chain; do not dispatch it.**
- No fixer; it stays filed-only. It is low severity, and it has a design question: `getDefaultValueBlob` does report the default, so a host could apply it.
  Warn or document is the maintainers' call. Dedupe neighbours: #11106 (closed), #12356 (default-value reflection getters).
- The fixer has been sent #14228 so it can add the "tracked separately" line to the #14221 description.
- 03:31Z: the #14228 `issue_opened` webhook arrived; not dispatched (as planned). Verified: OPEN, `reproduced`, 0 comments, no assignee.
  The fixer got the #14228 note at 03:30:31Z (seq 26); the #14221 description has no #14228 line yet. Check it at the next touch.

### 11-03 04:2xZ: review round 2, and two side finds sent to the triager

- These are the fixer's figures. Round 2 was REQUEST_CHANGES (small): a false E38016 for non-compute LLVM entry points, plus test lanes. The fix is applied; head ea91ceb (no force push). 34/34 PR tests, 3386/3386 subset. Round 3 (the last) is pending with slang-reviewer.
  The #14221 description carries "tracked separately in #14228" (verified).
- Side finds were sent to triager `ykqeww` (msg 75): file if reproduced on master and deduped, no fixer.
  **S1:** C-like `_generateUniqueName` does not reserve verbatim entry-point names (`helper` + entry `helper_0` → two `void helper_0(` on cuda; `main`/`main_0`; related #13264).
  **S2:** `[shader]`/`[numthreads]` on a prototype are not merged into the definition, silently (`LocalSize 1 1 1`).
  Their issue_opened webhooks will belong to this chain.

### 11-03 04:32Z: side finds filed as #14229 and #14230 (filed-only)

- **#14229 (S1):** generated `<name>_<N>` collides with a verbatim entry-point name. Two functions with one name on CUDA, HLSL, WGSL and Metal; `main` + `main_0` also collide on C++.
  Cause, per the triager: slang-emit-c-like.cpp writes entry names verbatim (:1145), and `_generateUniqueName` (:1151) never reserves them. Related: #13264.
- **#14230 (S2):** `[numthreads]`/`[ForceInline]` on a prototype have no effect. Reflection reports `[4,1,1]` but SPIR-V has `LocalSize 1 1 1`; DXC honours the prototype.
  `[numthreads]` on the prototype plus `[shader]` on the definition makes reflection list two `F`s. Close neighbours: #12515, #14200.
- Verified by Main: both are bot-filed, labelled `reproduced`, say "Found while working on #14221", and have no @-mentions.
- **Fan-out (Main 11-03): none, both filed-only.** #14230 has a merge-vs-diagnose design question for maintainers.
  #14229 is the follow-up candidate for slang-fixer once #14221 leaves review, so its edits don't run concurrently with the same chain's fixer.
  Their issue_opened webhooks belong to this chain.
- 11-03 (Main): the #14229 `issue_opened` webhook arrived; not dispatched, as planned. Verified: OPEN, `reproduced`, 0 comments, no assignee.
  The #14230 webhook is still due and gets the same treatment.
- 11-03: the #14230 `issue_opened` webhook arrived; not dispatched (as planned). Verified: OPEN, `reproduced`, 0 comments, no assignee, created 04:31:25Z.

### 11-03 06:23Z: Fix Report; PARKED on operator un-draft sign-off

- These are the fixer's figures. 17 files, +802/−99, 11 commits on 7f506f4c9.
  - The link-time check `checkEntryPointNamesAreUnique` adds **E38016**: SPIR-V checks per execution model, CUDA includes the OptiX prefix; GLSL, the Slang VM, non-compute LLVM and a renamed `main` are exempt.
  - `findFunctionDeclsByName` adds **E38017**, `-entry` ambiguity with candidate notes. An overloaded `[patchconstantfunc]` gives E39999.
  - Tests: 9 new tests, 38/38 lanes. Diagnostics 1050/1050; subset 3386/3386. The reviewer's full suite: 11225/11228, and the 3 failures (fp8-cuda) also fail on master on this L40S.
  - Review: R1/R2 REQUEST_CHANGES, both fixed. R3 APPROVE_WITH_NITS, nits applied.
- Verified by Main: PR #14221 is a DRAFT, head e8677fd84, mergeState BEHIND by 1 (#14150, no conflict).
  CI run 41589002700 is held at `wait-for-human-priority`. The fixer's explanation comment is 6592904573.
- **Main decision:** park on operator un-draft sign-off (a human clicks Ready; fixers can't).
  #14229 waits until #14221 **merges**, because it builds on the `main`-rename rule that #14221 shares with the emitters.
  The operator was asked on orchestrator-dashboard 11-03 ~06:3xZ.
- **Timer:** one-shot `rechase-slang-14053-r1-2e4f` 2026-11-05 16:30Z (decision table in its prompt; cap 3 re-chases).

## 2026-11-05

### 11-05 11:4xZ: operator triage ask for #14229 — verdict given by Main, no dispatch

- Live state: OPEN, `reproduced`, 0 comments. **jkwak-work self-assigned 11-04 17:23:47Z and milestoned Q1 2027 (Winter)** (rung 4, maintainer-owned).
  #14230 is also assigned to jkwak-work (Q4 2026 milestone). No PR references #14229.
- Main reproduced both examples (local Release slangc, checkout 04d2726db): s1 gives 2× `helper_0` on cuda/metal/wgsl/cpp/hlsl, exit 0; nvcc 12.6 rejects it.
  s2 (`main` + `main_0`) gives E40100, then duplicate `main_0` on cuda/metal/cpp. Cause verified in slang-emit-c-like.cpp: `maybeMakeEntryPointNameValid` (:1129) and
  `generateEntryPointNameImpl` (:1145) write names verbatim, while the per-key `m_uniqueNameCounters` in `_generateUniqueName` (:1151) never sees them.
- Verdict: emit / C-like naming, bug, low-medium P3, not a regression. #14221's E38016 exempts a renamed `main`, so example 2 falls in that gap.
- Next: no triager dispatch (the bot-filed body already is the triage) and no GitHub post. Fixer held for two reasons: the maintainer owns it, and it builds on #14221, which is still DRAFT.
  Resume on a jkwak-work ask or an @nv-slang-bot mention, or after #14221 merges if the operator clears it.

### 11-05 16:3xZ: r1 re-chase; no operator answer, so the PR moves to the weekly list, plus a merge conflict

- Live: #14221 is an OPEN DRAFT, head e8677fd84, `pr: non-breaking`, 0 human reviews or comments. **mergeStateStatus DIRTY.**
  `git merge-tree` against master 04d2726db shows one conflict, `source/slang/slang-check-shader.cpp`, from c8bd94448 (#14051, the portable ray-tracing API).
  #14147 (reporter PR) is still OPEN, not a draft.
- Dashboard (bounded read, seq 510372–511358): no operator answer to the 11-03 06:24Z ask (seq 510384).
- **No 2nd un-draft ask.** The weekly-list policy ([undraft-asks-replaced-by-weekly-list](../orchestrator/undraft-asks-replaced-by-weekly-list.md), 11-03 06:31Z) post-dates the r1 prompt. It forbids per-PR asks for a P2, non-regression fix.
  **State: ready-flip pending, review complete (R3 APPROVE_WITH_NITS applied).** `weekly-undraft-list-4573` (Mon 09:00Z) picks it up.
- Sent slang-fixer (msg 15, delivered seq 48 in `f9uw61`, thread gh-issue-shader-slang/slang-14053): plain-merge master, resolve the #14051 conflict, re-run tests, push, report the head. No `gh pr ready`.
  The fixer's reply routes to the r1 task session, so r2 verifies it on GitHub instead.
- Timer: r2 one-shot `rechase-slang-14053-r2-3f30` 2026-11-09 12:00Z, after the weekly list (2 of max 3).
- ⚠️ The `weekly-undraft-list-4573` prompt tells fixers to run `gh pr ready` once the operator approves. Fixer spines forbid that ([feedback_fixers_cannot_request_reviewers](../feedback_fixers_cannot_request_reviewers.md)), so the prompt needs fixing before its first bulk approval.

### 11-05 16:55Z: master merged into #14221 (fixer report, verified)

- Verified by Main: head c429a3999, MERGEABLE, still a draft. These are the fixer's figures: merge 5e3cd0e69 (parents e8677fd84 and master 04d2726db), no force push.
  The only conflict was against #14051 in `slang-check-shader.cpp`; the `notFoundSink` was dropped, and structural lookup now runs before E38000/E38017.
  #14269 made 5 failing-compile lanes declare `exit-code=-1`. Tests: 38/38 PR, 3477/3477 subset. CI run 42067743915 is gated (`wait-for-human-priority`).
- State is unchanged otherwise: on the weekly un-draft list; r2 `rechase-slang-14053-r2-3f30` 11-09 12:00Z. #14147 rebase-second rule still applies.
