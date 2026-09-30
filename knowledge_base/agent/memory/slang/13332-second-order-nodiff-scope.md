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
the question to him before opening a #13332 PR. His answer probably decides #13322's restore-support PR and
the siblings #13320–#13327 too, but he only commented on #13332.

**Resume:** `rechase-13332-2nd-order-ad11` (2026-09-30 18:00Z), or any human comment on #13332.
