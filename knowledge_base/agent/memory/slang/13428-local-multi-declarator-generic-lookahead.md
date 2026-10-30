---
type: chain
title: slang#13428 — local multi-declarator `int j = …, k = j < 2;` → E30015 (+ sibling #13430 / PR #13434)
description: "#13428 TERMINAL (PR #13432 merged 10-07, eaf758404f). Still live: sibling #13430's draft PR #13434 (457ae39a0e), waiting on the operator un-draft decision at a 72h cadence (11th ask 10-29). Side findings #13433/#13435 are owned by their own gates. Decision trail in [[slang/13428-13430-decision-trail.md]]."
tags: [slang, parser, regression, local-struct, live-chain]
---

# slang#13428 (external reporter andy-slater, 2026-10-04)

**Bug.** `ParseDeclaratorDecl` registered a declarator group's VarDecls only in `CompleteDecl`, after the whole
statement. So in `int j = …, k = j < 2;`, `tryParseGenericApp` → `CheckTerm(j)` couldn't see `j`, and E30015
stuck. It is a regression from #6281 (`7911c94373`, two-stage parsing), which the bisect confirmed. Triage is in
comment 5984460232.

## #13428: TERMINAL

✅ **PR #13432 MERGED 2026-10-07 13:39Z** by skiminki-nv at the approved head `11711dc20a` (merge `eaf758404f`),
and #13428 auto-closed. The PR uses Approach B (full `CompleteDecl` per declarator, one SharedModifiers per group,
no Body gate, no skip guard). A separate commit makes `visitBlockStmt` hide/unhide each `DeclGroup` member, which
also fixes a pre-existing master miscompile (`int y = j; int j = 1, k = 2;` read an uninit `j` and ignored the global
`5`). Another separate commit covers the local `S::N < 2` type-spec case. The stale branch `fix/issue-13428` @
`ae10b8b152` (Claude trailers, same tree `6b3bf010be`) is **kept on purpose**; nobody deletes it unless a maintainer asks.

## #13430 / draft PR #13434: LIVE

- **Bug:** in a local struct, a field init like `int b = a < 2;` gave E99997 "decl has no parent": the parser's
  lookup entered L before `L->parentDecl` was set. Same v2025.4→v2025.5 window, but a separate producer, so the
  #13428 fix doesn't cover it.
- **Fix (Approach B, my 10-05 call):** `parseDeclBody` drops `parser->semanticsVisitor` for its duration (RAII), so a
  local struct body parses like a global one. This follows docs/design/parsing.md's two-stage rule. Plus a parsing.md
  sentence and a local-struct `f<2>()` member-init row.
- **PR #13434** (branch `fix/issue-13430`): draft at `457ae39a0e`, 4 files +198/−2, closes [13430] only, 0 GitHub
  reviews, bot-only comments. slang-reviewer: APPROVE_WITH_NITS with 0 bugs. skiminki-nv is assigned and
  review-requested. 140 behind master as of 10-29 (MERGEABLE, BEHIND).
- **CI has never run:** the draft skips PR-event CI. The old dispatch 37270839605 (which was waiting on the
  human-priority/falcor gate) was **deleted** (404 as of 10-11). The PR Maintenance (board-sync) run seen on 10-11 is gone
  too: 0 runs, 0 check suites and 0 statuses as of 10-29. Don't re-dispatch around the hold.
- **Routing:** the pr-mapping is on fixer session `sess-1791148592366-vqg8p2`, thread `gh-issue-shader-slang/slang-13428`
  (no fixer session exists on the 13430 thread). The triager for 13430 is `sess-1791173244200-mu85w4`; the canonical
  thread is `gh-issue-shader-slang/slang-13430`.
- **Waiting on:** the operator un-draft decision. 11 asks so far (10-05, 10-06, 10-07, 10-08, 10-11, 10-14, 10-17 seq 505532, 10-20 seq 506182, 10-23 seq 507564, 10-26 seq 508092, 10-29 seq 508778), on a 72h cadence. The 9th–11th offered yes / no / **park** (park = stop re-asks, move to the parked-chain register).
  Nothing changed on GitHub between 10-08 and 10-29 except a 10-16 cross-reference from draft PR #13718 (the #13435 fix), whose body
  says #13434's tests pass on a master+#13434+#13718 build and that the two PRs are independent. The next re-chase is the
  `rechase-13434-undraft-292e` task at 2026-11-01 03:00Z. The fixer flips only on an explicit operator yes, and rebases only on maintainer request.
  To read the dashboard, `--reverse --limit 300` reaches back only ~6h on a busy day. Use `--since-seq <last ask seq> --limit 400`
  instead, paging forward (the 10-29 ask is seq 508778; 10-26→10-29 was 359 rows, 1 page). An operator reply could also land on Main's own 13430-thread session `sess-1791149243025-udt0ka` (last active 10-04). **Add `--full` when searching:** without it each text is cut at 300 chars, so a #13434 mention deep in a digest is invisible.

## Side findings (own chains, skip here)

- **#13433**: an interface `static const b = a < 2` → E30623 then Release SIGSEGV. Now jkwak-work's, triaged, and
  gated by `i13433-decision-gate-25d6`. See [[imported/project_13433_interface_static_const_witness_null_crash.md]].
- **#13435**: a local struct `static const int N = x + 1;` with `x` a function local is a silent miscompile (the
  `x = buf[0]` init is lost). jhelferty-nv assigned it to jkwak-work, with milestone Q4 2026, on 10-05. 0 comments,
  On **10-16 13:08Z skiminki-nv decided: reject, no capture.** A local type can't access the enclosing function's
  locals, params, or local types, and a method body `L::get()` is covered too. They asked `@nv-slang-bot` for a draft fix PR
  with their snippet as a diagnostic test (E30015 is OK). They reassigned the issue to themselves (cmt 6216197368). I released it to
  slang-triager on `gh-issue-shader-slang/slang-13435` (separate draft PR #13718 on `fix/issue-13435`, opened 10-16 18:21Z). The gate task is already
  gone (per-issue recurrences are now forbidden, R10).

## Lessons

- **A diagnostic-shaped repro must check the exit code.** I called #13433 "could not reproduce" because my probe
  printed only the first error line. The correct E30623 printed first, then Release segfaulted (rc 139).
- **"Ask once reviewer + CI are green" can't be met on a draft** when the draft state itself is what skips CI. Ask
  for the un-draft decision with the review verdict alone.
- **A maintainer who approves and marks a PR ready owns the branch now.** Our fixer must not rebase it on its own
  initiative, because a push would invalidate the approval.
- Comment-only gates miss assignment and milestone changes. Read the issue timeline at each re-chase.
