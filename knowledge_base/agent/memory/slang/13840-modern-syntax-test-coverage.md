---
type: chain
title: slang#13840 — improve test coverage of modern-style syntax
description: MEMBER-filed (jhelferty-nv) 10-21 21:40Z test-coverage request; maintainer assigned jvepsalainen-nv, set Type=Testing + labels. Routed to no coworker, nothing posted. Resumes only on a human comment.
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

Session: Main `tn9tvo` on `gh-issue-shader-slang/slang-13840`. A later human comment (an
`@nv-slang-bot` ask, or a request for test cases) is a live inbound: route it by what it says.
