---
name: project-12261-statement-labels-non-breakable
description: "slang#12261 — labels accepted on non-breakable stmts; missing-diag P3; PARKED awaiting maintainer error-vs-warning decision"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6363b9b1-bdbb-43d0-b63c-35a5636bbdad
---

# slang#12261 — Statement labels accepted on non-breakable statements

Reporter **skiminki-nv** (MEMBER, self-filed, deferred to triage/design). Filed 2026-07-29.
Issue: https://github.com/shader-slang/slang/issues/12261

**Bug:** Parser accepts a statement label before ANY statement, but a label is
meaningful only as a `break` target. Labeling a declaration / `if` / empty-stmt
is silently accepted with no diagnostic; when a `break` targets it, E30054
("invalid break target") fires at the `break`, not at the mislabeled statement.

**Triage (slang-triager, 2026-07-29):** bug / missing-diagnostic / **low / P3 /
frontend (semantic-checker)**. Reproduced @HEAD `6dba5d212` (frontend, no GPU);
`reproduced` label applied. All reporter file:line pointers verified exact.
Verdict posted on issue (comment **5116505218**).

**Right fix layer:** `SemanticsStmtVisitor::visitLabelStmt`
(`source/slang/slang-check-stmt.cpp:130`) — after checking inner stmt, guard
`!as<BreakableStmt>(stmt->innerStmt)`. `BreakableStmt` = `LoopStmt`
(for/while/do-while), `SwitchStmt`, `TargetSwitchStmt`. Breakability is currently
enforced only from the break side (`visitBreakStmt`, `slang-check-stmt.cpp:191`;
diag `target-label-does-not-mark-breakable-stmt`/E30054,
`slang-diagnostics.lua:1350`). Lowering drops the label
(`slang-lower-to-ir.cpp:8082`).

**PARKED at triaged — hold for maintainer.** Fix hinges on two forks the reporter
explicitly punted:
1. **Severity** — hard error (language-breaking, needs `pr: breaking change`
   label) vs **warning-first deprecation** (non-breaking; triager recommends B,
   precedent #12236/#9999 chose warning for analogous nil-impact tightening).
2. **Duplicate-diagnostic** handling for `lbl:{break lbl;}` — accept both label-site
   + break-site errors, or mark `LabelStmt` reported and suppress break-site diag.

In-tree impact nil: only labeled stmts under tests/source are on loops/switches
(`tests/language-feature/multi-level-break*.slang`).

**2026-07-29 maintainer update (skiminki-nv, comment 5121858533):** "tentatively
set this for **Slang 202c**. Probably not worth adding this restriction for Slang
2026 and previous." → milestone = **202c** (next lang version; breaking change
acceptable there). Leans toward the restriction (hard error) landing in 202c, but
does NOT explicitly pick error-vs-warning, does NOT address the duplicate-diag
sub-decision, and does NOT say "make a PR." Forwarded to slang-triager to
assess whether this unblocks or the chain stays parked pending explicit form +
"make a PR". Chain re-activated (was parked).

**2026-07-29 (later) — issue state:** `slang 202c` label + milestone `Q3 2026
(Summer)` added, and **skiminki-nv SELF-ASSIGNED** the issue. Decisive signal:
self-file → self-triage → self-assign = MEMBER intends to own the implementation.

**PARK-STILL / watch-only (no autofixer).** Self-assigned+self-filed no-autofixer
pattern (cf. jkwak/csyonghe rule): dispatching slang-fixer would risk a
competing/duplicate PR against the assignee's own work AND pre-commit the unresolved
severity fork. No new issue comment — the label+milestone are the public timing
record; the parked verdict's blocker (severity + dup-diag) is still accurate;
re-posting = churn.

**Resumption trigger:** resume ONLY if the assignee (or another maintainer)
explicitly says "make a PR" AND picks severity (error-vs-warning) — unlikely given
self-assignment; more probable skiminki lands it himself. **If skiminki opens his
own PR, that is TERMINAL for our chain (no bot PR).** On a live handoff, re-request
the `triage-12261.md` briefing from slang-triager on this canonical thread (the
inbox path `a2a-1785320911879-2jk95g/triage-12261.md` may be stale).

**Doc nuance:** reporter's cited path
`docs/language-reference/statements-break-and-continue.md` does not exist @HEAD;
real `statements.md` is *silent* on label placement (spec gap, not contradiction).

Same park pattern as [[project_12258_metallib_3_2_windows]] and the switch-diag
cluster ([[project_12260_enum_bool_switch_e39999]]).
