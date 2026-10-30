---
type: chain
title: slang#13840 — improve test coverage of modern-style syntax
description: MEMBER-filed (jhelferty-nv) 10-21 21:40Z test-coverage request, Type=Testing; reassigned 10-26 to tangent-vector. Held 10-21 (no dispatch); operator asked for triage 10-29 11:33Z, so it went to the triager (session 9tcxyi), triage only, no fixer. TRIAGED 11:43Z (cmt 6495725468, medium, frontend); the incident was our bot's PR #13406. Parked on tangent-vector (A vs A+B); one-shot re-check t-950df7 11-05 12:00Z.
tags: [slang, testing, test-coverage, parser, routing]
---

# slang#13840 — test coverage for modern-style declarations

**10-21 21:40:39Z, `issue_opened`.** Live read at ~21:5xZ: OPEN, 0 comments, body = payload.
Author jhelferty-nv (`author_association` MEMBER). Within 30 s of filing, the timeline shows jhelferty-nv
assigning **jvepsalainen-nv**, setting Type `Testing`, and adding labels `Test Coverage` + `Testing`.
The self-assign at 21:40:53Z was undone at 21:41:05Z. No milestone. A duplicate search found nothing.

**Ask:** most tests use legacy-style function declarations; add coverage for the modern style.
The motivation is that an agent PR removed parameter-declaration diagnostics that would have relaxed
modern-style checking, and a human reviewer (Tess) caught it.

**Routing: no coworker, nothing posted.** Reasons:
- It is a coverage goal with no reproducer, and a maintainer has already routed it to a named human
  (the same shape as the #12241 tracking issue: core team + no reproducer means no dispatch).
- The body comes from a maintainer who is wary of agent changes in this area. A triage comment
  from the bot would add noise and no information.
- The R6 wait gate (nanoclaw#1993, still a draft on 10-21) would hold this anyway. That gate
  does not apply yet, so this decision rests on the first two reasons.

## 10-29 — operator asked for triage

- **11:33Z** dashboard-admin (msg 30): "Triage subsystem + severity + next step. Report back with your verdict on
  the canonical thread." That overrides my 10-21 hold.
- Live read: OPEN, 0 comments. On **10-26 17:32Z** jhelferty-nv reassigned it from jvepsalainen-nv to **tangent-vector** (Tess).
- The R6 gate, nanoclaw#1993, **merged 10-25 with no waiting period**. It only skips `GoodFirstBug`/`HelpWanted`/`no-bot`
  (and `bot-ok` opts an issue in), so the "4-day hold" in [13591](13591-authorship-rules-r-series.md) is obsolete.
- **11:34Z** dispatched to `slang-triager` on the canonical thread (msg 37; the first send failed with `database is locked`
  and left no row). The new triager session `sess-1793273662024-9tcxyi` got exactly one inbound. Scope: a coverage gap
  inventory with parameter-declaration diagnostics first; no label/Type/assignee changes; no fixer; a short public
  comment; it then parks on tangent-vector.
- **11:44Z [Report]** (triager msg 44, memo msg 46 `triage-13840.md`). Comment **6495725468** (11:43Z, nv-slang-bot) is live; I checked it.
  **The incident was our own bot PR #13406**, "Split the Ref passing mode by access". It was assigned to jhelferty-nv and merged
  10-22 08:47Z. Tess's review comment r4342226984 (10-21 21:35:56Z, I checked it) said the PR flipped modern-style parameters
  from immutable to mutable by default. The triager says the fix landed as 4060f3092 on the #13406 branch (it exists on GitHub,
  10-22 03:27Z, headline "Reject const on out and inout parameters"), and that the rule now lives in `isModernParam`, `slang-check-decl.cpp:1709`.
  Gaps (the triager's, checked against master 01dcd3568): (1) no test that a modern `in` parameter is immutable (E30011/E30047/E30050),
  (2) E30621 is tested only through accessors, and `let x;` E30620 is untested, (3) the parameter diagnostic tests are all legacy syntax.
  Next action: tangent-vector chooses approach A (one pinning test) or A plus B. No fixer.

Session: Main `tn9tvo` on `gh-issue-shader-slang/slang-13840`. A later human comment (an
`@nv-slang-bot` ask, or a request for test cases) is a live inbound: route it by what it says.
