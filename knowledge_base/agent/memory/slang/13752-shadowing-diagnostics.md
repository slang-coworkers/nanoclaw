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
