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

**11-20 12:07Z — 10.5h stall caught by a duplicate maintainer ask; recovered 12:10Z.** The fixer
turn ended right after its 01:34Z ack without doing the announced claim/worktree/re-verify (no
provider-outage signal). jkwak-work re-posted the identical "@nv-slang-bot triage and make a PR"
at 12:07:10Z (comment 7039129065) — that surfaced the stall. Recovery: 👀 id 478480274 on the new
comment; pinned nudge 12:08Z (dormant container woke); issue comment posted 12:10:12Z
(7039188722, Main-verified clean: triage rollup + fix plan, addresses both maintainer comments,
bot footer, zero markup debris — the 01:34Z watch-item did not recur). Fixer continuing: sentinel
→ worktree → re-verify (3-day drift) → fix → PR `fix/issue-14548`. Operator informed (msg 81 —
incl. fleet-health note: supervisor tick missed this; surfaced via the duplicate ask ~10h late).
**Next: [Fix Report] + PR + report_pr_created. Escalate to operator if it stalls again pre-PR.**

**11-20 12:46Z — PR #14663 LIVE (fix complete, Main-verified).** "Enforce [require] on variable
declarations" — head `b4cb4d0cd8ed58aff720d8d519921cd0b7defaca`, label `pr: non-breaking`,
**created NON-draft** (defensible: maintainer asked "make a PR" directly; the fixer's report
mislabelled it "draft"). pr-mapping wired → fixer sess 69bclj (webhooks route there). 4 commits
(failing repro → fix → internal-branch test pin → comment-name fix), 2 files: the merge in
`checkVarDeclCommon` (+58 lines, source/slang/semantic-checking/slang-check-decl.cpp:23086 — note
the file moved from source/slang/ per the #14540 merge) + new 5-case test
tests/diagnostics/require-on-var-decl.slang. PR body concise/clean (Fixes #14548, footer); 9.9k-char
explanation comment 7040141855; issue correction comment 7040080404. CI run 44740348796.
Tests per report: repro 5/5 (3 issue shapes → E36107 on hlsl, function control unchanged);
diagnostics 1115/1115, capability 96/96, ray-tracing 264/264; gated-var smoke on 5 targets.
**Brief corrections the fixer made to the triage memo (do not trust the memo on these):**
(1) "checkFunctionCommon" does not exist — the real function-path merge is `visitFunctionDeclBase`
(:23268); (2) the memo's full `getDeclaredCapabilitySet` parent-chain approach broke the core
module (E36120 via param/local re-injection into target_switch case validation) — the fix merges
OWN attributes only, documented in the PR explanation.
**State: reviewer round in flight** (slang-reviewer has the [Fix Review Request]); fixer owns PR
webhook events via mapping; maintainer response routes to it. Operator rollup msg 91.

**11-20 13:00Z — maintainer follow-up ask: FILE an enum-values issue.** jkwak-work on #14548
(comment 7040168182): "@nv-slang-bot please file another issue to support the `[require]` on
enum variables" + example with [require(spirv)]/[require(hlsl)] on enum VALUES. 👀 id 478521726.
Dispatched to slang-triager (pinned to fs0kmz — its session has the capability-area triage
context; in_reply_to=46 to clear the stale unresponded rows) 13:01Z: verify current behavior on
master → dedup → file on the bot account (enhancement framing per "support"; family context to
#14548/PR #14663 plain-text; no Fixes links, no @-mentions) → reply on #14548 with the number →
report up. **DONE 13:08Z:** **#14664 filed** (Feature, `Capability System`; parse rejection E20001
at `parseEnumCaseDecl` slang-parser.cpp:6856 + no capability path for `EnumCaseDecl` — deeper
gap than the var one; reply to jkwak-work cmt 7040326816; Main-verified). Record:
[14664-require-enum-cases-feature.md](14664-require-enum-cases-feature.md) — filed-only; its
issue_opened webhook = own filing, NO triage dispatch. Side observation (whole-enum [require]
escapes via qualifier-only `float(MyEnum.FirstValue)` refs, #14332 family) flagged to the
operator (msg 101) — file-or-leave is their call.

**11-20 15:39Z — BOTH REVIEW ROUNDS COMPLETE (APPROVE_WITH_NITS ×2, 0 bugs); shipped at head
`9bec847`** (8 commits, +339/−79 cumulative: own-`[require]` merge + `getOwnDeclaredCapabilitySet`
shared helper, extension member vars via `_checkExtensionMemberCapConflict`; 10 consumer + 4
decl-site invocations; diagnostics 1124/1124, capability 96/96, ray-tracing-2 264/264). Two-round
cap reached — fixer ships. Main-verified: head `9bec847eb`, label `pr: non-breaking` (a reviewer
suggested `pr: breaking change` — fixer kept non-breaking and flagged the flip as a MAINTAINER
call, not unilateral), CI 44764355528 mostly green, branch behind master (fixer reconciles at
merge). Declined-with-justification items + adjudicated Reviewer-B false positive covered by
CHECKFIELD, documented in the PR explanation (7040141855, current). Incident: a crashed codex
critique corrupted the worktree (removed a just-added call) — caught by the next critique's
stale-log check, recovered cleanly; fixer recorded a shared learning; flagged to operator
(msg 137) as an infra item. **11-20 15:41Z — PR human-moved to ready-for-review; label call surfaced to the maintainer.**
A human (not the fixer) moved PR #14663 to ready (verified draft:false, head `9bec847eb`,
`pr: non-breaking`, reviewer kaizhangNV requested); CI green/running. The C005 label question
(non-breaking vs breaking) is now an explicit PR comment to jkwak-work (7043730951, 15:41:35Z):
the PR newly errors on previously-compiling `[require]`-carrying user code — maintainer's call,
label kept non-breaking pending it. Round-2 reviewer chain fully closed. Minor infra: the
critique-gate state wipes on new inbound batches (a blocked "PR creation" notification was
actually the explanation-comment upsert; PR-body edit + label comment posted fine) — **verified
2nd occurrence 17:58Z: `/workspace/.claude/workflow-state.json` resets per inbound batch →
phantom gate denials while artifacts actually post; risk = the "attempt N of 3" counter tripping
admin escalation on phantom blocks; flagged to operator msg 159; fixer shared a fleet learning
(verify the artifact live before re-running; check the state file, not last turn's approvals).**
Counter advancing: attempt 2/3 at 18:18Z with all demanded stages run — the gate structurally
cannot reach all-approve while parked (its RE-CHECK requires a kaizhangNV reply newer than
17:57:52Z, which is the very thing being awaited; it even triggers on read-only fetches).
**Attempt 3 = admin page, EXPECTED and BENIGN — disposition given to operator msg 163.** The
by-design parked state is recorded verbatim in the critique ("Blocked on pending human input;
no author action available").
**11-20 17:58Z — kaizhangNV REQUESTED CHANGES: design-first revision; chain PARKED on his
per-rule confirmation.** Review 5997064389 (Main-verified, supersedes jkwak's approval): "we
are not very clear about the rules... please don't merge this PR." Followed his three probes
(chained `c=a+b`, `func<a>()` generic value args, metal-entry laundering — two real escapes
confirmed empirically). Fixer: acked same-turn (7046650258, no merge), posted the **5-rule
rule-set proposal** (comment 7046802310, 17:57:52Z): R1 own-[require] (shipped), R2
initializer/chained constants (= #14661 filtered walk), R3 generic value args propagate (new
work — closes the laundering hole), R4 member-narrowing (A strict-intersection vs B union,
open call), R5 enum cases (#14664). On his confirmation: implement confirmed deltas → re-verify
→ re-request review. **PR #14663 is now the anchor for the broader capability rule set —
#14661 and #14664 converge into its frame (R2/R5).** Parked-chain handling: webhooks wake the
fixer on his reply; one-shot re-check `recheck-14663-kai-rules-d05c` armed (fires 11-21 18:00Z;
decision table: reply/state moved → report only; silent → ping fixer to nudge once; merged →
Terminal + report). **Recheck fired 11-21 18:00Z: kaizhangNV silent since 17:57:52Z (fixer
verified live) → single polite nudge comment posted by the fixer (7066960702, 710 chars,
18:02Z) — ONE nudge total; do NOT nudge again — if he stays silent, the next step is an
operator escalation with the state, not another comment.** Label question (non-breaking vs breaking) still open with jkwak.
Operator rollup msg 155.

**11-20 14:05Z — round 1 complete.** slang-reviewer verdict
APPROVE_WITH_NITS (0 bugs), all nits applied → new head `a83748bf4` (6 commits, 3 files
+195/−33: own-`[require]` merge + shared helper `getOwnDeclaredCapabilitySet`, 6 consumer-side
test cases + 2 decl-site tests; diagnostics 1118/1118, capability 96/96, ray-tracing 264/264;
target smoke E36107 on hlsl/metal/cuda/wgsl, clean spirv). Gap 1 (initializer walking) declined
with the #14332/#14661 justification, now documented. Explanation comment updated in place
(7040141855). jkwak-work's 13:12Z approval auto-dismissed by the push — fresh re-approval + CI
(run 44749879497) + merge are human-owned. **PR #14661 (initializer walking) edits the same
function — whichever lands second reconciles one comment line** (fixer owns that on this PR).
PR currently `behind` master — the fixer reconciles per merge events. Related follow-up chains
from this issue: #14664 (enum cases — owned by sibling Main musn8y's dispatched fixer w4o1cq,
NOT this session). Sibling-session note (12:46-13:0xZ): first pr_ready_for_review webhook
reached Main → slang-pr-approver paused → queue entry in data/approver-pause-queue.md +
operator one-liner (approver-pause handling per the paused-approvers rule). The dangling
sibling 12:46Z duplicate note below is superseded by the sections above; retained for
attribution only:
> 11-20 12:46Z — PR #14663 OPEN (+157/-0 initial); report_pr_created OK (pr-mapping → this
> chain); jkwak-work COMMENTED 12:58Z; CI 12 pass/0 fail; pr_ready_for_review → approver
> paused → queue entry + operator one-liner.
