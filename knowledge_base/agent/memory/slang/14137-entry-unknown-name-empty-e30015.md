---
type: chain
title: slang#14137 — unknown `-entry` name prints an empty `error[E30015]: undefined identifier` before E38000
description: Human-filed (albertrodriguezclo) diagnostics bug 2026-11-01 14:29:23Z. Triaged Bug/low/P3. DEFERRED to the reporter's PR #14147 (opened 11-01 23:00Z, same shape as A'); D2/B1 split out to bot-filed #14193 (owned by the #14190 chain). Triager one-shot i14137-r6-post-a7ff 11-05 14:35Z records state only; no post, no fixer.
tags: [entry-points, diagnostics, r6]
---

# slang#14137 — empty E30015 before E38000 for an unknown `-entry` name

**Ask.** `slangc ub.slang -target spirv -entry mian` prints `error[E30015]: undefined identifier`
(no name, no location) before the real `error[E38000]: no function found matching entry point name 'mian'`.
Reporter (master 9a4817c88, also 2026.19, also `-target cuda`) wants only E38000. Their diagnosis:
`findEntryPointFuncDecl` (slang-check-shader.cpp) → `translationUnit->findDeclFromString(name, sink)` runs
`CheckTerm` with the real sink (`ComponentType::findDeclFromString`, slang-linkable.cpp); suggested fix is a
throw-away sink for that lookup. That is the reporter's claim, not yet verified.

**GitHub state (11-01, verified by Main).** 0 comments, no labels, no assignee, no linked PR. No `bot-ok`,
no crash word → **R6: no bot comment, PR or commit naming #14137 before 2026-11-05 14:29:23Z.**
`grep 14137 memory/` hit only a slangpy comment id (false positive); the only session on the thread was
my own webhook session. Reporter self-PRs often (≥28 open PRs) — a reporter PR is likely.

**Related.** #14053 (same reporter): `-entry Count` with overloads gives a misleading E38000
(`findFunctionDeclByName` drops the `OverloadedExpr`, slang-check-shader.cpp:933); its approach C adds an
`-entry` ambiguity error in the same code path. A fix for one may touch the other.

**Dispatch (11-01).** slang-triager, thread `gh-issue-shader-slang/slang-14137`, R6 stated; triage
locally, report to Main, schedule a one-shot post/hand-off at or after the hold ends (checking first for a
reporter PR or maintainer reply). Next touch: the triager's report.

**Triager interim (11-01 14:32Z, triager's finding, not verified by Main).** Reproduced on ToT 6815ed82d and
2026.13.1 (spirv + cuda); superseded by the full triage below (D2 is from #10125). Lead: the identifier name lives in the diagnostic's span
label, which is dropped when there is no location, so the empty E30015 may be a diagnostic-rendering producer bug,
not only a duplicate-report one. Full report pending.

**Triage (slang-triager, 11-01 14:40Z; memo `/workspace/inbox/a2a-1793544052109-qugv04/triage-14137.md`).
These are the triager's findings; Main verified only the GitHub state.** Bug / low / P3, frontend entry-point lookup
+ compiler-core rich renderer. Two defects:
- **D1, duplicate error** (since at least v2026.3.1, which printed `undefined identifier 'mian'` + E38000).
  `findFunctionDeclByName` (slang-check-shader.cpp:932) passes the user sink to `findDeclFromString`; its
  `CheckTerm` reports E30015, then E38000 (:960). The reporter's cause is right.
- **D2, empty E30015** (from #10125, v2026.4). The name lives only in the span label; the rich renderer
  (slang-rich-diagnostics-render.cpp:897-929) drops all labels when the location does not resolve, and it never
  resolves because `parseTermString` (slang-session.cpp:1075) uses a stack-local SourceManager. `-diagnostic-format vs`
  prints the name.
- Other callers: `[patchconstantfunc("typo")]` gives 3 errors (bare E30015, E38000 wrongly saying "entry point",
  E31006); `-specialize Bogus` prints ONLY a bare E30015, so A alone does not fix it (needs B1).
- Options: A throw-away sink; **A' (rec.)** = A + move E38000 into `findAndValidateEntryPoint` (:2887);
  B1 renderer prints the primary label without a location (expected-output churn; separate commit/follow-up,
  maintainer call); B2/B3 alternatives.
- #14053 overlap: same lines (:928-968), no semantic conflict; #14053 first, #14137 after.

**GitHub (verified by Main 11-01 14:4xZ).** Type=Bug, label `reproduced`, 0 comments, no assignee, no PR.

**Main decisions (11-01).** (1) No `regression` label: the defect the reporter asked about (D1) predates #10125;
D2's #10125 origin goes in the post as text. (2) Do not block on #14053 *merging*: if its PR is unmerged when the
fixer starts, base on master and note the overlap on both PRs. (3) The post must name the `-specialize` path so B1
is not lost. Owner: slang-triager, thread `gh-issue-shader-slang/slang-14137`. Next touch: the one-shot report 11-05 14:35Z.
Triager confirmed 11-01 14:42Z that all rulings are in the one-shot prompt and in comment-14137.md (R6 guard first,
then (0)→(a)→(b)→(c)), and that it corrected the #14053 state page, which had said to build on the #14053 branch.

**11-02 ~16:00Z (Main `3oaflr`, from the #14183 chain): DEFER to the reporter's PR #14147.** albertrodriguezclo opened PR #14147
("Fixes #14137", non-draft, reviewer jhelferty-nv) on 11-01 at 23:00:57Z, after this triage; this record did not know about it.
Following the #14153 → #14170 precedent, I told the triager (pinned `jjf21j`, landed as seq 26) to amend the one-shot
`i14137-r6-post-a7ff`: no fixer handoff, no bot PR, no triage post while #14147 is open, and report to Main if it closes
unmerged. B1 (renderer drops location-less span text) is now tracked by #14193, which #14147 doesn't fix.

**Triager applied the defer (11-02 16:01Z); GitHub verified by this Main session 11-02 16:0xZ.** #14147
"Report an unknown entry point or patch-constant function name once" by albertrodriguezclo, opened 11-01 23:00:57Z,
OPEN, not draft, body "Fixes #14137", review requested from jhelferty-nv; touches only slang-check-shader.cpp + two
diagnostics tests (same shape as A'). D2/B1 (renderer drops the primary label without a location) is now bot-filed
**#14193** (11-02 15:58Z, from the #14189 R1 reviewer finding), owned by a sibling Main session's
[#14190 chain](14190-14192-cpu-atomic-side-bugs.md), not this one. #14137 still has 0 comments.
One-shot `i14137-r6-post-a7ff` (11-05 14:35Z) now: #14147 open or merged → record state, no post; #14147 closed
unmerged → report to Main and wait for a go-ahead before reviving A'. Never: fixer hand-off, bot PR, `regression`
label, or B1/`-specialize` text (that is #14193's). #14053's C(2) now overlaps #14147: base on master and note
#14147, or rebase after it merges (triager recorded this on the #14053 page). Next touch: a #14147 merge/close
webhook or the one-shot.
