---
type: chain
title: "slang#14548 — [require] on variables is not enforced (declared caps never merged into the var's inferred set)"
description: Bot-filed 11-17 by the PR #14540 review chain; echo misroute #3 stood down + remediated same day; 11-20 maintainer GO (jkwak-work "triage and make a PR") → fixer chain active (sess 69bclj, triage memo as fix brief)
tags: [slang, capabilities, semantic-check, require, variables, active-chain]
---

# slang#14548 — `[require]` on variables silently unenforced

**The bug (filer-verified on master `2a91af5b7`).** `[require]` on a variable (global/static const,
static const data member — generic or not) is never enforced: `SemanticsDeclCapabilityVisitor::
checkVarDeclCommon` (`slang-check-decl.cpp:23064-23079`) seeds the inferred set from
`inferredCapabilityRequirements` but never calls `getDeclaredCapabilitySet(varDecl)` / merges the
var's own `[require]` modifiers. The function path (23264-23317) does the merge — control case
enforces correctly (E36107). Consumers of the var compile clean for unsupported targets, exit 0.

**Filing.** 11-17 13:41:48Z by nv-slang-bot, author chain = the **PR #14540 review chain** (the
#14430 fix's review; issue text explicitly says the variable gap is independent of PR #14540 and
still reproduces with that fix applied). Filing state: labels `reproduced` (filer-applied 13:41:51Z),
0 comments.

**Echo misroute #2 (recurrence of the #14546 lesson, same day).** My 13:44Z issue_opened handling
dispatched a full triage chain (triager session fs0kmz) — memory number-grep false-emptied (no chain
record yet; the filing raced the webhook) and the R6 batch-window detector didn't apply (no batch).
Detected the error ~13:45Z reading the 14546 index entry: the body's verification-results signature
(master sha + repro status + root cause) marks it as our own Terminal filing. Stand-down sent
13:45Z (pinned to fs0kmz, delivered seq 4) BEFORE any public post; 👀 (id 662956010) removed;
operator informed (dashboard msg 23, 13:5xZ).

**Disposition: FILED-ONLY.** No triage chain, no fixer, no public bot posts. Fixer-chain go-ahead is
an operator/maintainer decision per [the filing policy](../orchestrator/filing-verified-issues-policy.md).
My recommendation to the operator: clean, well-scoped fix adjacent to the active #14430 chain in
the same file — start now or after PR #14540 lands to avoid `slang-check-decl.cpp` churn.

**Detector fix (in memory/index.md Core Memory R6 bullet).** Bot-authored body containing
verification results = own filing, regardless of any batch window. See the recurrence note in
[14546-mul-hint-matrix-vector-star.md](14546-mul-hint-matrix-vector-star.md).

**Precedent note (honest record).** Earlier the SAME day, mid-chain side-find filings #14535 and
#14537 (fixer-chain side-finds with verification in the body) DID get triager dispatches that
stood (triage → park fixer on operator). Those predate the 11:43–11:50Z echo-misroute lessons
(#14542, #14546); the later categorical lesson governs going forward: mid-chain side-find
filings are filed-only + report to operator, and any triage/fixer start is the operator's call.
Flagged to the operator in the 13:5xZ dashboard report so the pattern can be confirmed or
corrected.

**Stand-down race + remediation (final state, triple-confirmed 13:47–13:51Z).** The triager composed its turn
from the dispatch only (stand-down seq 4 landed mid-turn): completed triage, posted public
comment 6949917419, armed watcher t-5d0adf (fires 14:45Z, "owns the dispatch"). Two interleaved turns
resolved it: the remediation turn (processing the stand-down) cancelled the watcher at 13:47Z
(`touched: 1`, registry row gone — no task references 14548) and deleted the comment at 13:47Z, while
the stale dispatch-turn report (13:48Z) still described both as live and cited a "13:42Z ruling" —
per the triager's 13:51Z msg 46, that was a filing-phase thread message IT had logged as a ruling
(so the triager group was aware of the filing before my dispatch — it armed t-5d0adf at 13:43Z,
pre-dispatch), now moot/disowned. Live issue verified by me AND the triager: 0 comments, labels
exactly filer-applied `reproduced`, 0 reactions, no assignees; no fixer handoff. Corrective
follow-up sent 13:50Z (pinned, in_reply_to its report): FILED-ONLY ruling made unambiguous — no
triager-owned timer may dispatch a fixer; operator's go-ahead flows Main→chain only. Triage memo
itself is a keeper: repro re-verified on master 2a91af5b7, root
cause re-confirmed (function path :23262-23317 = the model; recommended approach mirrors its
merge), fixer traps (a) no initializer visiting (#14332 revert), (b) merge into the var's OWN
inferred set not a parent's (E36104); body correction: var walk covers the type only.
Preserved: [raw/triage-14548.md](raw/triage-14548.md). Operator deltas: msg 23 (13:46Z) +
msg 47 (13:5xZ).

**11-20 01:29Z — MAINTAINER GO; fixer chain ACTIVE.** jkwak-work (self-assigned; labels now
`reproduced` + `Capability System`) posted on the issue: "@nv-slang-bot triage and make a PR"
(comment 7027518088, live-verified byte-exact). The filed-only hold is released by the maintainer's
own public instruction — not an operator call needed anymore. Dispatch: 👀 on the comment (id
478012788); **slang-fixer sess-1795138346849-69bclj** minted 01:32Z on the canonical thread with
the triage memo inlined as fix brief (root cause, function-path model, #14332/E36104 traps,
acceptance incl. E36107 on all 3 repro shapes + new diagnostics test; PR #14540 same-file
coordination: check merge state, merge master first; 3-day line-ref drift → re-verify on current
master). Fixer acked 01:32Z (worktree → re-verify → then one comment on the issue with triage
rollup + plan, answering both halves of the ask). Operator informed (msg 61). **Watch-item:** the
fixer's ack carried stray markup debris (`<message to="parent">test` fragment — provider
serialization glitch); check its first GitHub comment for the same debris before it stays long.
Awaiting the fixer's 5-bullet [Fix Report] + PR + report_pr_created on this thread.
