---
type: chain
title: "slang#13752 — missing shadowing diagnostics (params, locals, generic params)"
description: skiminki-nv filed + self-assigned 10-19. Split by the triager 10-22. Part 1 (generic-param shadowing) is implemented locally by slang-fixer, with the PR held on Q3. Part 2 is parked on Q1–Q3.
---

# slang#13752: shadowing diagnostics

- **Filed 2026-10-19** by skiminki-nv, who self-assigned it. Labels: `slang 202c` (human), `reproduced` (bot).
  Umbrella #13719; sibling issues #13720 and #13750. #1924 overlaps case 6.
- **Sessions on `gh-issue-shader-slang/slang-13752`:** triager `sess-1792434348109-mtpy68`,
  fixer `sess-1792671856026-4whzxj`, and me (`…wd0qod`).
- **10-19 triage** (cmt 6274915754): all 7 cases are silent. E30515 (`visitGenericDecl`) checks
  only generic type params; `checkForRedeclaration` checks only the same container.
- **10-22 12:11Z, the author's rules** (cmt 6340420495, "tentative"):
  - All shadowing of generic params is a warning in 2018–2026 and an error in 202c.
  - `{ int i = i; }` is a warning; whether it is an error in 202c is still to be confirmed.
  - `if (let i = i)` is allowed in all versions.
- **10-22 12:24Z, the triager's split** (cmt 6340664563):
  - Part 1 (generic params, cases 1–4) goes to the fixer.
  - Part 2 (cases 5–7 and the two idioms) is parked on these questions:
    - **Q1:** Is `if (let i = i)` completely silent?
    - **Q2:** Are cases 5–7 a warning or an error in 202c?
    - **Q3:** Are members that reuse a generic param's name (`struct A<let N:int>{ int N; }`) in scope?
  - Re-check `t-39f36a` is set for 10-26 12:00Z.
- **10-22 18:34Z, the fixer's Part 1 report:**
  - 7 local commits on `fix/issue-13752` (E30515/E30527 before 202c, E30528 in 202c), not pushed.
  - slang-test: 11,134 passed. The 3 fp8-cuda failures also fail on unmodified master.
  - The PLAN_REVIEW gate blocks `gh pr create`. Its must-fix: "All shadowing" includes members.
  - **My decision: hold the PR on Q3.** Adding members is a requirement the author has not stated,
    and Q3 is already posted. The fixer measures member hits meanwhile and keeps its commits safe.
    I did not override the gate; the operator can.
- **Follow-up when Part 1 nears merge:** SlangPy `slangpy/slang/gridarg.slang:4/10/19` (`GridArg<let N>`
  with `__slangpy_load<let N, …>`) will hit E30515, a true positive. It needs a slangpy-side rename;
  route it to slangpy-fixer before the slang PR merges.
- **10-22 18:36Z:** the triager posted a short Q3 yes/no follow-up (cmt 6348380066; I verified it is
  on the issue). `t-39f36a` (10-26 12:00Z) now reports an unanswered Q3 as the Part 1 blocker and
  posts nothing new on GitHub. When Q3 is answered, the triager relays it verbatim to the fixer.
- **10-22 19:14Z, fixer:** the commits are backed up to `/workspace/agent/patches/fix-13752.bundle`
  (fixer group folder). Codex now approves the code; it found and the fixer fixed a later-declared
  local and unused local aliases. PLAN_REVIEW is still must-fix, only on members/Q3. The fixer will
  report member-walk hit counts after the final-head suite run. Nothing is pushed or opened.
- **10-22 20:05Z, fixer, member-walk measurement:** it fires on all 4 Q3 shapes. Hits: **0** in the
  core and GLSL modules; **2** in `tests/`, both the fixer's own negative cases. 20 crash files, all
  also crashing on master. Branch HEAD `f8a8fd45a`; prototype at `patches/proto-13752-members.diff`.
  If Q3 is "yes": apply the prototype and flip the 2 tests. If "no": quote the answer to close the
  must-fix. Then push and open the draft PR. I asked the triager to add the 0-hit figure to its
  18:36Z comment by editing it in place.
- **10-26 12:01Z, re-check `t-39f36a`:** Q1–Q3 are still unanswered. I verified there are 0 comments
  after 6348380066. skiminki-nv is active elsewhere (#13876, 10-23). The PR is still held, with no
  GitHub post. The triager set a follow-up one-shot, `t-33c6ef`, for **10-30 12:00Z**. If Q3 is
  still open then, the triager will ask me to choose: escalate to the operator, or ship Part 1
  with members excluded (prototype as a follow-up).
- **10-30 12:02Z, re-check `t-33c6ef`:** Q3 is unanswered for the 2nd time (8 days; 0 comments after
  6348380066). skiminki-nv is active on #13880, #13876 and #13956. The triager asked me to choose
  between escalating and shipping without members. The operator gave no reply on the 10-22 option.
  **My decision (10-30): open the draft PR now, with members INCLUDED as a separate, droppable
  commit** (the prototype), and Q3 stated as an open question in the PR. Why:
  - It follows the literal "All shadowing" and C++ precedent, and it costs 0 hits.
  - It clears the PLAN_REVIEW must-fix without a gate override (only the operator can override).
  - A bot PR draws skiminki-nv's review fastest.
  - If Q3 is "no", the fixer drops that one commit.
  The PR uses `Refs #13752`, not `Fixes`, because Part 2 is still open. The PR also flags that
  skiminki-nv deferred 202c strictness to #13956 on #13880.
- **10-30 13:16Z: DRAFT PR #14093** (`fix/issue-13752`, head `0b237ea55`). I verified:
  - It is a draft, labelled `pr: non-breaking`, and uses `Refs #13752` with no `Fixes`.
  - Q3 and the SlangPy gridarg note are in the body, with no external links.
  - The members commit `0b237ea55` is separate and is the head commit.
  - pr-mapping points to fixer `sess-1792671856026-4whzxj`. Draft CI: 3 pass, 54 skipped.
  - The SlangPy rename is still to be routed before the PR leaves draft.
- **10-30 13:20Z, fixer Fix Report:** #14093 head `0b237ea550cc`, 8 commits on master `1f0b33b86`.
  - Suite: 11313/11316; the 3 fp8-cuda failures also fail on master. All gates approve.
  - The [Fix Review Request] is with slang-reviewer.
  - Added beyond the prototype: enum cases and properties. A lambda capture-field false positive in
    202c was fixed by skipping members of synthesized types.
  - Explanation comment 6523755998; status comment on the issue 6523761393.
- **10-30 13:21Z: SlangPy rename routed** to slangpy-fixer on this thread (`gridarg.slang` lines 4/10/19,
  plus a sweep of all `.slang` files, pure rename). Its worktree is `wt-slangpy-13752`, off main
  `10311ca8`. Awaiting its PR number.
- **10-30 13:56Z: SlangPy DRAFT PR shader-slang/slangpy#1254** (`fix/issue-13752`, head `3f4c45312`). Verified:
  - Only `gridarg.slang` changes (+5/-5, N→D in both `__slangpy_load` overloads), and the PR cites slang#14093.
  - No `Fixes`; mapped to slangpy-fixer `sess-1793366457865-l3w8os`.
  - Compiling all `.slang` sources (including the 12 that need defines) with the #14093 compiler: 0 hits after
    the rename, and 4 hits on the pre-rename positive control.
  - Pinned-Slang SPIR-V is byte-identical, and `test_grid` passes.
  - Merge order: slangpy#1254 can land any time before or after; it must land before slangpy bumps to a
    Slang that contains #14093.
- **10-30 14:02Z, slangpy-fixer Fix Report for #1254:**
  - Peer review is requested from slangpy-reviewer; kaizhangNV is the auto-assigned shepherd.
  - Flag, not changed: the loops use the method's `D` to index the struct-sized `offset`/`stride`, which
    looks like the method's `N` was meant to be the struct's `N`. It is safe today, because SlangPy always
    passes `ContextND<N>`.
  - I verified the flag is in the PR's explanation comment 6524592584 (the "Possible intent mismatch"
    callout), so maintainers will see it. No relay is needed.
- **10-30 14:05Z:** slangpy-reviewer **APPROVED** #1254 @3f4c4531 (0 bugs; 1 non-blocking question on the
  pre-existing D-vs-N hazard; no GitHub post). Promotion to ready is a human step, so I asked the
  operator to click "Ready for review". It is independent of slang Q3.
- **10-30 15:13Z: #14093 after review round 1**, head `9280e5721`, 12 commits, still a draft.
  - 4 review-fix commits were added after the members commit. The members commit `0b237ea55` is still
    distinct, so if Q3 is "no" it is removed by a revert rather than a plain drop.
- **10-30 15:13Z, round 1 report:** slang-reviewer returned REQUEST_CHANGES (small).
  - Fixed: duplicate 202c errors for interface default methods and for local aliases in a lambda body.
    The warning test now pins severity.
  - Suite 11314/11317 (fp8-cuda only). Round 2, the last, is with slang-reviewer.
  - Possible interaction with open PR #13718: whichever lands second needs one more rule. This is in
    the Process report.
- **10-30 15:14Z:** #13718 is a bot draft for #13435, owned by slang-fixer `sess-1792157909195-kj3jso`.
  I sent that session a pinned FYI about the land-second rule. It landed as seq 52, verified; the pin
  used `in_reply_to=18` (my pr_mention webhook row). No action is needed until either PR merges.
- **10-30 16:39Z, final Fix Report:** #14093 head `e10ef70f6`, 14 commits, +1064/−49. Verified it is still a
  draft; review is requested from jhelferty-nv (auto); CI run 41091908116 is pending.
  - Both slang-reviewer rounds were REQUEST_CHANGES (small). All blocking items are fixed: compiler-made
    declarations are marked `SynthesizedModifier`. Two-round limit reached.
  - Suite 11314/11317 (fp8-cuda only).
  - If Q3 is "no": revert `0b237ea55` and remove the member test rows by hand.
  - Open for the maintainer: Q3; whether the implicit setter `newValue` is reported (kept; Devin
    disagrees); the #13718 land-second rule; the #13880/#13956 202c deferral.
  - Human steps: skiminki-nv answers Q3 and reviews; a human marks the PR ready. I told the fixer to
    cite slangpy#1254 in the PR's Risk line.
