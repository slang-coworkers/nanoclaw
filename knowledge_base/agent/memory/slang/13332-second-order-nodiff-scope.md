---
type: chain
title: slang#13332 — second-order derivative crash on a no_diff differentiable value; maintainer scope question
description: Bot-filed #13322 follow-up. jkwak-work says second-order is unsupported (diagnose, don't crash), but the user guide documents it as supported. The question has been relayed to the owning fixer session and is pending.
tags: [autodiff, second-order, maintainer-decision, 13322-family]
---

# slang#13332

**What it is:** a second-order derivative (`bwd_diff` of a `fwd_diff` wrapper, or fwd-over-fwd) crashes when a `no_diff`
value of an `IDifferentiable` type reaches a differentiable parameter. It's a regression from #9808 (`45ccce9a3`);
v2026.5.2 compiles it. slang-triager filed it at 2026-09-29 21:01Z on `gh-issue-shader-slang/slang-13322/nodiff-receiver`.

**Owner:** the slang-fixer session `sess-1789716207340-dwbdoz` (thread `gh-issue-shader-slang/slang-13169`),
which claimed it at 21:03Z. Its parent edge is the #13169 Main session. slang-reviewer is also running a
review on the `gh-issue-shader-slang/slang-13332` thread. When waking the fixer, pin `target_session_id` to that
session. Without the pin, the canonical thread mints a new session with no context.

**Open decision (maintainer):** jkwak-work, 2026-09-29 23:09Z (cmt 5900809446): *"As far as I know,
second-order derivative is not supported. Slang is supposed to print diagnostics but if it is crash, then
we need to make it not crash."* That **conflicts with** `docs/user-guide/07-autodiff.md:858-877`
(saipraveenb25's #6202 overhaul, plus the #11901 double-bwd restriction). The guide documents nested
`fwd_diff` and a single `bwd_diff` over `fwd_diff` as supported, and says only double-backward is diagnosed.
The comment was relayed verbatim, with the conflict under an Orchestrator note. The fixer was asked to put
the question to jkwak-work before opening a #13332 PR. Their answer probably decides #13322's restore-support PR and
the siblings #13320–#13327 too, but jkwak-work only commented on #13332.

**Question posted:** nv-slang-bot cmt 5901045613 (2026-09-29 23:30Z). Rechase passes `-ad11` (09-30) and `-1eb1`
(10-02, the last one, not re-armed) both found it **unanswered**. The fixer's patch is local only: `fix/issue-13332` @ `891ead286f`, held.

**2026-10-02: possible overlap.** saipraveenb25 (MEMBER, assignee of #13320–#13323 and #13327) opened **PR #13360**
"Fix differential pair handling in higher-order autodiff" on 2026-10-01. Its motivating example is the #13332 shape
(a `no_diff` receiver, bwd over fwd). It touches `translateMakeDifferentialPair` and `transposeMakePair`, the same two
layers the fixer named, and it treats these cases as "should compile". So it implicitly sides with the guide.
It does not reference #13332. CI was green at the time. I asked the operator on the dashboard whether to ping
saipraveenb25, jkwak-work, both, or hold until #13360 lands. **Resume:** operator reply, any human comment
on #13332, or #13360 merging. When #13360 merges, re-run the #13332 repro and its variants against master
before any fixer PR.
