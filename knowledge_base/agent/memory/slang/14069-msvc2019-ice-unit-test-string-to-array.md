---
type: chain
title: slang#14069 — `unit-test-string.cpp` hits MSVC 2019 (14.29) ICE C1001 on `constexpr std::to_array` (since #13217)
description: Human-filed (minco3, NONE) build-break regression 2026-10-29, R6 crash-exempt. Triaged low/P2 (fix A, plain array). TERMINAL 11-02 — the reporter's PR #14072 merged (8e0a545). Option D (vs2019 presets) open with the operator.
tags: [build, msvc, unit-test, tools, r6]
---

# slang#14069 — MSVC 14.29 ICE in `unit-test-string.cpp`

**Ask.** With VS2019 (cl 14.29.30133), `slang-unit-test` fails in every configuration with
`unit-test-string.cpp(508): fatal error C1001: Internal compiler error`. The reporter says the cause is
`constexpr auto parseInt64FailCases = std::to_array<const char*>({...})`, which #13217 added. MSVC 14.38+ is fine.
Their proposed fix is `constexpr const char* parseInt64FailCases[] = { ... };`, with no loop change.

**Context.** #13217 is skiminki-nv's human PR "Fix intToAscii() and parseInt() functions", merged 2026-09-23;
its chain was archived 09-24. The same file was the subject of the GCC 14 `-Wstringop-overflow` chain
[#13770](13770-unit-test-string-memcpy-warning.md) (closed 10-22, merged #13782). minco3 is a human contributor
(their draft #13583 is on the #13108 chain).

**10-29 23:4xZ checked live:** OPEN, 0 comments, no labels or assignee, empty timeline, no duplicate by search
(`to_array`, `parseInt64FailCases`). The only session on the thread was my own webhook session.
**R6:** no `bot-ok` label, but the title and body say "crashes" and the fenced block holds the C1001 ICE line,
so it is crash-exempt and a bot comment may be posted at once.
Dispatched to slang-triager on `gh-issue-shader-slang/slang-14069`. No fixer until the triage is back.
- 10-29 23:47Z, triager progress (its finding, not re-checked by me): the line is confirmed at 480/508 on master `1f0b33b8`,
  and the same file has 4 more `constexpr std::to_array` uses. Toolset-support check and Compiler Explorer repro still running.
- **10-29 23:54Z [Triage] back:** regression bug, low, P2, CI-build. Memo `/workspace/inbox/a2a-1793318064508-frmut6/triage-14069.md`.
  I checked GitHub: bot cmt 6511336250 (23:53:58Z) and labels `regression` + `reproduced`, Type=Bug, still unassigned. These are the triager's
  findings, not re-run by me: a full-TU Compiler Explorer repro gives C1001 at :508 on cl 19.29 only, and 19.30+ compile (so the reporter's
  "14.38" bound is too high). The file before #13217 compiles on 19.29. The other 4 `to_array` uses (:392/:419/:456/:530, struct element
  types) are fine. No CI job builds VS2019 (`cmake-options.yml:96-97`), but `CMakePresets.json:52-65` and `docs/building.md:64` still offer it.
  Recommended fix A is the reporter's plain-array 2-line change.
- **PARKED on the reporter.** The bot comment invites @minco3 to open the PR ("If you do not, an automated fixer can do it"), so
  no bot PR yet. GO to the triager: schedule a one-shot re-check at 2026-11-02T23:55Z. If minco3 has opened a PR or declined by then,
  hand off accordingly; if still silent, hand off to slang-fixer with A. A minco3 comment arrives by webhook earlier.
  Open operator/maintainer question, unfiled: whether to drop the vs2019 presets and docs (option D).
- 10-29 23:56Z: the triager confirmed the re-check is scheduled as `i14069-recheck-35d7`, one-shot at 2026-11-02T23:55:00Z, in the triager's
  group (not visible from Main, so `ncl tasks get` from here says not found). If minco3 asks for more time, it reports to me instead of
  handing off. Option D was put to the operator on the dashboard 10-29 23:55Z; no answer yet.
- **11-02 ~20:52Z: minco3 opened PR #14072** (branch `fix/msvc142-to-array-ice`, 1 file +2/-2 in `unit-test-string.cpp`, closes #14069,
  head `97aeb194f1`, created 10-30 00:11Z; the ready_for_review webhook reached me only now). This is fix A by the reporter, so **no bot fixer PR**.
  slang-pr-approver is paused: not forwarded, queued in `data/approver-pause-queue.md`. I did not ping the triager; its 23:55Z re-check
  covers "minco3 opened a PR". If it hands off to slang-fixer anyway, stop that (it would duplicate #14072).
- **11-02 23:57Z TERMINAL, fixed by the reporter.** I checked GitHub: minco3 opened fork PR **#14072** (`fix/msvc142-to-array-ice`) on 10-30 00:11Z,
  18 min after our invite. The diff is exactly fix A (1 file, +2/−2, `Fixes #14069`, `pr: non-breaking`). jkwak-work merged it 11-02 22:32:05Z as
  `8e0a5457e0`, and the issue closed `completed` at 22:32:07Z. No fixer was dispatched, and only one bot comment (6511336250) was posted; the triager
  added nothing, since the merged `Fixes #` records the outcome. The approver-pause queue entry (data/approver-pause-queue.md:133) is marked MOOT.
  The re-check `i14069-recheck-35d7` has fired and is done. **Only open item:** option D (drop the vs2019 presets and docs) is still the operator's call,
  unanswered as of 11-02. From now on, observe only; a human comment webhook would reopen the chain.
