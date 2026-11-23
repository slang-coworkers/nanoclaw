---
type: chain
title: "slang#14664 — Support [require] attributes on enum cases"
description: Feature ask, maintainer-requested (jkwak-work on #14548, 11-20 13:00Z), triager-filed 13:08Z with parse+semantic verification; FILED-ONLY
tags: [slang, capabilities, require, enums, feature, filed-only]
---

# slang#14664 — `[require]` on enum cases

**Origin.** jkwak-work asked on #14548 (comment 7040168182, 11-20 13:00:19Z): "please file
another issue to support the `[require]` on enum variables" (example: per-case
`[require(spirv)]`/`[require(hlsl)]`). Direct maintainer instruction — filed without further
gating per policy.

**Filed:** 11-20 ~13:08Z by slang-triager (sess fs0kmz) on the bot account — "Support [`require`]
attributes on enum cases", labels `Capability System` + Issue Type Feature, deduped (none), no
Fixes links / @-mentions; plain-text family context to #14548/PR #14663 (which is OPEN, not
merged — wording correction from my dispatch brief the triager caught). Reply to jkwak-work on
#14548: comment 7040326816 (number + verification digest).

**Verification (triager, master `6492e91c4`, fresh release slangc; Main spot-checked the filing):**
current behavior is a hard parse rejection — E20001 "unexpected '['" exit 2, both cases;
`parseEnumCaseDecl` (source/slang/parser/slang-parser.cpp:6856) never parses modifiers. Second
half: `EnumCaseDecl : Decl` dispatches to `SemanticsDeclCapabilityVisitor`'s no-op `visitDecl`
(source/slang/semantic-checking/slang-check-decl.cpp:1481) — no capability path even if it
parsed. Control: whole-enum `[require(spirv)]` IS enforced in type position (E36107 on hlsl,
clean on spirv). Framing = Feature (new surface / hard rejection, not silent misenforcement);
no `reproduced` label.

**Side observation (unfiled, operator flagged 13:1xZ, msg 101):** whole-enum `[require]` ESCAPES
via qualifier-only references (`float(MyEnum.FirstValue)`, no type annotation → compiles on hlsl
despite spirv requirement). #14332 reference-shape family. Operator deciding: file as sibling
bug vs leave to the #14664 work.

**Disposition: FILED-ONLY → SUPERSEDED 13:27Z: maintainer GO "triage and make a PR" (cmt 7040732912,
self-assigned) → chain LIVE.** #14664's webhooks route to sibling Main session
**musn8y** (it took the 13:07Z issue_opened — correct echo-rule disposition — and the 13:27Z
pr_mention), which dispatched **slang-fixer w4o1cq at 13:29Z**. Fixer progress by 13:37Z: 4-invocation
repro test committed (all fail E20001 on master), parser modifier fix (enum cases) +
`visitEnumCaseDecl` own-`[require]` merge applied, Debug build in flight. **My 14:06Z dispatch was
a DUPLICATE** (acted on the #14548 fixer's [Fix Report] FYI without grepping sessions for an
existing owner — the number's webhook stream belonged to musn8y). **Containment mechanics
(corrected 14:10Z): BOTH my 14:06Z dispatch and my 14:08Z "disambiguation" misrouted into the
#14548 fixer session 69bclj** (reply-edge auto-stamp from its [Fix Report] beat thread_id AND
target_session_id — the in_reply_to-beats-pin hazard, 6th recurrence, first with an explicit
pin). w4o1cq never saw either message. The actual containment was 69bclj's sentinel-collision
protocol: detected the peer claim (sentinel 13:29:42Z, 3 commits on fix/issue-14664), stood
down, posted nothing, asked Main for the routing decision. Decision sent on 69bclj's own edge
(in_reply_to=122): the 13:29Z session (w4o1cq, verified alive/mid-build) keeps #14664;
69bclj stays on #14663 watch; acked 14:10Z. **Two lessons: (1) before dispatching on an FYI,
session-grep the number — a sibling Main may own the webhook stream; (2) you cannot pin to a
same-group sibling session from a turn whose inbound is from that same group — the reply edge
always wins; route the correction on the sender's own edge instead (done).** Operator
correction msg 133 (msg 123's "contained into the same session" was wrong). Stay out of w4o1cq's
inbox — it reports to musn8y. Resume on human comment only after merge.

**11-20 13:27Z — MAINTAINER GO; fixer chain dispatched.** jkwak-work (self-assigned) posted
"@nv-slang-bot triage and make a PR" (comment 7040732912, live-verified byte-exact) — the
filed-only hold is released by the maintainer's own public instruction, mirroring the #14548 GO.
👀 id 478544525 on the comment. Dispatched 13:2xZ to slang-fixer on canonical thread
`gh-issue-shader-slang/slang-14664` with the filing's verification inlined as fix brief (parser
`parseEnumCaseDecl` slang-parser.cpp:6856 never parses modifiers → E20001; `EnumCaseDecl : Decl`
→ no-op `visitDecl` slang-check-decl.cpp:1481; whole-enum control enforced in type position),
acceptance from the issue body (FirstValue → E36107 on hlsl, SecondValue clean on hlsl,
diagnostics test), #14663 traps (real function-path merge = `visitFunctionDeclBase` ~:23268; merge
OWN attributes only — parent-chain `getDeclaredCapabilitySet` broke the core module E36120; file
moved to source/slang/semantic-checking/), and coordination: PR #14663 OPEN unmerged, same file
— check merge state, merge master first. Scope note: qualifier-only-ref escape of whole-enum
`[require]` (side observation above) is NOT in scope unless the maintainer says so.
Awaiting the fixer's ack + 5-bullet [Fix Report] + PR + report_pr_created.

**11-20 14:43Z — PR #14665 LIVE (fix complete pending review, Main-verified).** "Support [require]
attributes on enum cases", branch fix/issue-14664, head `19c64c3d9b76fcb04ca51b02d205c6c9989738e2`,
label `pr: non-breaking`, **created DRAFT** (3 files; PR body summary-style like #14663's accepted
precedent). pr-mapping wired → fixer sess `sess-1795181347092-w4o1cq` on this canonical thread
(report_pr_created OK, Main-verified row). Tests per fixer: repro 5/5, diagnostics 1115/1115,
capability 96/96, enums 117/117 (all green). Parser fix (parse modifiers in `parseEnumCaseDecl`) +
`visitEnumCaseDecl` capability path (merging the case's OWN [require]s into its inferred set —
per the #14663 OWN-attributes trap). Issue comment 7042350227 (triage rollup + plan); explanation
HTML received 14:43Z (inbox a2a-1795185817863-z782xm). Fixer acked 13:37Z mid-build; ~75 min
claim→PR (13:29Z→14:43Z). **State: reviewer round in flight** (fixer dispatched its peer reviewer); full
5-bullet [Fix Report] follows the reviewer verdict. **jkwak-work flipped the draft READY
himself at 14:54Z** (Main-verified draft=false; no bot `gh pr ready` needed, weekly-list moot);
first approver event dispositioned at 14:5xZ: slang-pr-approver paused=1 (live-checked) → queue
entry added to data/approver-pause-queue.md + operator one-liner. **jkwak-work APPROVED the PR
at 14:54:47Z** — review 5994628339, "Looks good to me" (Main-verified; same minute as his flip;
merge stays human-gated, informational for the chain). CI run 44757930283 queued from the ready
trigger (draft-era runs yielded per wait-for-human-priority; outcomes via webhook). Diff: 3 files,
+96/−0. **Review round 1 (15:35Z): REQUEST_CHANGES — 2 probe-confirmed bugs, both fixed:**
(1) the `ParseModifiers` call regressed bareword case names colliding with modifier keywords
(`enum FilterMode { point, linear, sample }` stopped parsing) → replaced with a bracket-only
attribute loop; (2) unscoped-enum aliases dropped the case's `[require]` → the visitor now
propagates the aliased case's inferred set onto the parser-synthesized alias. Also adding round-1
test coverage (composition, stacked-require union, invalid attribute names, unscoped-enum, switch
consumer, tag boundary), comment fixes, a user-guide paragraph. **R1 fixes applied 16:09Z at new
head `ec6784392771`** (4 commits, CI auto-triggered; repro 11/11, diagnostics 1121/1121,
capability 96/96, enums 117/117 — bareword + unscoped-alias now pinned by test invocations; PR
body, explanation comment, issue rollup refreshed for the new head). Review round 2 (of max 2)
dispatched, verdict pending; on approve → [Fix Report], if still REQUEST_CHANGES → ship with
unresolved findings listed. **Head moved again by 17:39Z → `3166d2fa` (13 commits total,
mergeable:true, Main-verified; explanation comment 7042389134 documents this head — the HTML file
the fixer sent 17:39Z is the round-1-head version, superseded).** **jkwak-work's approval (review
5994628339) is stale at the old head `19c64c3d`. **[Fix Report] 17:39Z — FIX COMPLETE, awaiting maintainer merge.** Final state (Main-verified): 5 files +429/−31 — parser bracket-only attributes on cases (keyword modifiers stay parse errors); `visitEnumCaseDecl` unions the case's own [require] sets; unscoped-enum alias joins the case's requirements in `checkVarDeclCommon`; tests 3 files/14 invocations; user-guide `[require]`-on-cases section. Tests: repro 14/14, diagnostics 1124/1124, capability 96/96, enums 117/117 (re-run by peer reviewers). Review: APPROVE_WITH_NITS after 2 full three-reviewer rounds, 0 bugs at final state, all nits applied; one finding declined with justification (case+enum conflict-check relocation — behavior change beyond nit scope; disclosed as known limitation in the PR body Risk section). **Anomaly: jkwak-work's LGTM auto-dismissed on the round-2 push** (Main-verified: reviews = his DISMISSED entry only, reviewDecision null) → no standing approval; the fixer can't re-request (no-reviewer-request rule) → **maintainer re-approval is the one human action outstanding.** PR at head `3166d2fa` (ready, `pr: non-breaking`, merged current master; final-head CI 0 fail, 12 in-flight; issue rollup comment 7042350227). Webhook-driven for follow-ups. **Pre-disposition (fixer addendum 17:42Z): an incoming
`ci_failed` webhook for run 44754665290 is the draft-era dispatched run on the twice-superseded
round-1 head `19c64c3d` completing as a priority-yield** — failed jobs are exactly
wait-for-human-priority + check-ci, every real test job skipped. NOT a real failure: no rerun, no
code change, no nudge; the retry/aging automation owns it. Current head `3166d2fa`'s CI = run
44781774030 (queued). Reviewer thread closed (round-2 nits-applied confirmation in). Coordination
watch: PR #14663 (#14548) still open, unmerged, same file — merge order with #14665 to be watched
at review-complete (update 14:07Z: #14663 now head `a83748bf4`, reviewer APPROVE_WITH_NITS, nits
applied — per v38232's dashboard rollup; the sibling Main owning #14548).

**Routing incident (v38232, #14548 chain Main, 14:06Z — containment complete, for the record).**
Acting on the fixer's FYI without a session-grep, it dispatched a duplicate 14664 brief; BOTH its
messages misrouted into the #14548 fixer (69bclj) via the reply-edge hazard (6th recurrence —
inbound from the fixer group beat thread_id AND pin). 69bclj's sentinel-collision protocol stood
down, nothing posted; routing ruling sent on 69bclj's edge: w4o1cq (mine) keeps the chain. v38232
corrected its dashboard rollup 14:10Z. No residue: w4o1cq never saw the duplicates.
