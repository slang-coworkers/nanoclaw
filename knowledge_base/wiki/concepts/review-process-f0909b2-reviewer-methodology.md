---
title: Correctness-review methodology — coverage lenses, codegen reproduction, and self-finding discipline
type: concept
group: review-process
tags: [reviewer, review-lens, revert-drill, positive-control, codegen-reproduction, use-dependent, exit-0, self-raised-finding, file-list, silent-miscompile]
source_count: 12
---

## TL;DR

Correctness review of Slang compiler PRs turns on one recurring question: does the test
actually EXERCISE the changed path, and did the reviewer REPRODUCE the exact scenario before
confirming or refuting? Compilation and clean exits prove far less than they appear.

- **Revert-drill every newly-threaded/recursive parameter or new guard.** Mentally delete
  it and ask "does any existing test now fail?" If all tests still pass without it, its real
  (nested/deeper) path is untested — the distinctive job of a threaded parameter is the case
  ONE LEVEL DEEPER, and the failure mode there is often a SILENT miscompile, not a loud abort.
- **A structural CHECK/CHECK-NOT is not numeric coverage.** When a fix targets a specific
  conformer/branch, confirm a runtime `-cpu COMPARE_COMPUTE` actually ROUTES through that
  branch and pins its result — a test that dispatches the wrong variant verifies the path
  only structurally, and a live-payload miscompile passes silently.
- **Reproduce a reviewer's/codex's EXACT source + EXACT flags before disputing.** Codegen and
  reflection effects are use/lowering-dependent — "unused vs used," "-emit-spirv-directly vs
  not," "global param survives vs copied-to-local" all flip the result. A near-miss repro
  produces a false-negative and a wrong shared conclusion.
- **A static IR gate is necessary but not sufficient.** `as<IRGlobalParam>` gating a
  reflection side-effect does not prove "non-manifesting" — you must craft the repro to
  exercise the SURVIVAL path, or say "unverified" rather than confirm.
- **Don't close a finding YOU raised on the author's unverifiable EXIT=0.** A clean compile
  proves the program compiled, not that the mechanism you worried about behaved as claimed;
  keep it open as a coverage/justification gap. You MAY push back on the critic and still
  ship where it's wrong, but concede immediately where it's right.
- **Re-check the full FILE LIST of post-review fix commits** — accidental PR-body/scratch
  `.md`, dotfiles, logs slip in via a broad `git add .`; a merge-blocker no code review catches.
- **Silent-impossible-shape smell:** a new legalize/handler that converts a loud
  `SLANG_UNEXPECTED` into a silent default for any input is a red flag — re-assert the invariant.

## Coverage lenses: numeric routing and the revert-drill

Two lenses from reviewing slang#12875 (AnyValue bulk-copy / empty-struct legalize) generalize.
The **numeric-routing** lens: the fix's target was the `Foo2` conformer whose collapsed
context drives a new zero-fill, but the `-cpu` test dispatched only thread 0 under
`numthreads(1)`, selecting `Foo1` — the uninteresting case — so the collapsed path was verified
only structurally (`CPP-NOT: packAnyValue…`) and a live-payload miscompile would pass silently;
confirm a runtime COMPARE_COMPUTE routes through the target branch and pins its result. The
same PR also carries a **silent-impossible-shape** lesson: the new `legalizeBitCast` Form-2 sat
in the shared all-targets `legalizeInst` switch, turning a loud `SLANG_UNEXPECTED` into a silent
default for any empty-source bit_cast — hardened by asserting `as<IRAnyValueType>` before the
zero-fill, gating on the source TYPE not the operand value
[Review lens: AnyValue bulk-copy / empty-struct legalize — numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md).
The **revert-drill** lens, from the same PR: a fix threaded a `bool enclosingPreserved` flag
down a recursive `countWordScalarLeaves`, and two new tests looked like coverage but both tripped
a *local* check (the empty was a direct field), never the threaded flag — the distinctive job of
the parameter (an undecorated empty inside an undecorated inner struct inside a preserved outer)
had zero coverage, and the failure mode was a silent miscompile. For any newly-threaded parameter
or new guard, delete it and ask whether any existing test fails; if not, demand a test that
exercises the deeper case in both member orders plus a numeric readback
[Review lens: a threaded/recursive parameter can be 'tested' only via its LOCAL checks — revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md).

A third coverage lens governs "reject unrepresentable input" / "add a guard" fixes, traced across two
rounds of slang#13063 (slangi/HostVM `printf("%s", <runtime String>)` SIGSEGV). Round-1: when a crash
is fixed by adding a guard at ONE site that calls a fallible layout query
(`getNaturalSizeAndAlignment`), the highest-value check is to search for SIBLING call sites running the
same query on a related type that the fix left unguarded — here `kIROp_Var` and `kIROp_Store` query the
POINTEE type (`tryGetPointedToType`) and stayed unguarded, so an unrepresentable pointee still gets a
silent 0-byte slot with no diagnostic (and the PR-cited `checkUnsupportedInst` safety net does NOT run
for HostVM). Grade **Gap (not Bug)** if crash-reachability from the silent slot is unverified, and ask
the author to factor check-diagnose-reset into one shared helper used at every layout-query site
[reviewing 'reject unrepresentable input' fixes: check sibling layout-query sites](../learnings/1789396536261-reviewing-reject-unrepresentable-input-fixes-check.md).
Round-2, once the gap is closed by that shared helper (`getRepresentableSizeAndAlignment` routed
through 4 sites), verify three things beyond "is the gap closed": (a) the helper's doc doesn't
OVERSTATE coverage — it claimed to be shared by EVERY VM slot while ~16 other raw
`getNaturalSizeAndAlignment`/`getNaturalOffset` calls stayed raw, safe only via an implicit invariant
that lived only in the PR body (reword to name the guarded sites); (b) some new guards may be
DEFENSIVE/redundant rather than load-bearing — `kIROp_Var`/`kIROp_Store` were removal-insensitive
(type-keyed dedup + a co-located function-result guard already caught the type), and slang's methodology
discourages guards "never hit under correct input", so for a FINAL-round PR ask to mark them defensive
or `SLANG_ASSERT` the invariant rather than demand removal (a nit, not a blocker); and (c) A-vs-C
disagreements on a COMMENT's accuracy are signal to SURFACE, not resolve. Verdict mapping: a round-1
REQUEST_CHANGES whose round-2 carries 0 bugs and only clarity/message/test-coverage gaps is
APPROVE_WITH_NITS, not REQUEST_CHANGES; confirm Devin re-analyzed the new head (its analysis names the
round-2 helper/test files) before trusting a "clean" result. Complementarity: this sibling-coverage
class was caught ONLY by Reviewer A's correctness subagents — B/C rarely flag missing sibling coverage
[round-2 review of a 'factored guard into shared helper' fix: doc-overstatement + defensive guards](../learnings/1789401172349-round-2-review-of-a-factored-guard-into-shared-hel.md).

A resource-lifetime lens transfers the same "exercise the failure path" discipline to slang-rhi
backends: **pooled staging + RAII free-on-scope-exit + a queue-wait that can FAIL = in-flight page
reuse.** Reviewing slang-rhi#869 (Vulkan `readBuffer` via the pooled `m_readbackHeap`), when a readback
(a) submits a GPU→staging copy, (b) waits via `queue->waitOnHost()` (= `vkQueueWaitIdle`), then (c)
frees the staging, scrutinize the FAILURE path between (b) and (c) when the staging comes from a SHARED
pool: `vkQueueWaitIdle` can return `VK_ERROR_OUT_OF_HOST/DEVICE_MEMORY`, and OOM is NOT device loss —
the queue is alive and the submitted copy may still be in flight, so "wait-fail ⇒ device loss ⇒ the
race is moot" is a FALSE premise. `StagingHeap::Handle::~Handle()` frees with NO completion fence, so
freeing on the wait-fail path marks the pooled region reusable while its GPU copy may still be writing —
no concurrency needed, a later SEQUENTIAL readback re-allocs the same region → torn data. The sibling
asymmetry blocks the easy fix: `readTexture` frees only AFTER success, so on failure it LEAKS and trips
the teardown `SLANG_RHI_ASSERT(m_totalUsed == 0)` — so "just mirror readTexture" is also wrong; the
only robust fixes couple the free to GPU/command completion (fence/token) or quarantine the region.
Meta: run the codex critique gate on the RESOLUTION/verdict, not just the code — it caught the reviewer
closing this as "accept, 0 bugs, not blocking" on the device-loss premise, and the OOM counterexample
flipped it to an open blocking error-path defect
[slang-rhi review lens: pooled staging + RAII free + fallible queue-wait = in-flight page reuse](../learnings/1789444437478-slang-rhi-review-lens-pooled-staging-raii-free-on-.md).

## Reproduce the exact scenario; a static gate is not a proof

Codegen effects are use/lowering-dependent, and a partial repro lies. During an OUTPUT_REVIEW
codex claimed a global `RayQuery` under `-fspv-reflect` emits `UserTypeGOOGLE "rayquery:<0>"`; a
"refutation" with three tests concluded "non-manifesting" — and was WRONG, because all three
*used* the RayQuery (lowering it to query ops and copying it to a local before the reflection
pass), while codex's sharper reproducer left it **unused** in a `[noinline]` body AND added
**`-emit-spirv-directly`**, so it survived as an `IRGlobalParam` and the decoration WAS emitted.
Running codex's literal case immediately turned a 5-round must-fix into an approve — cheaper and
more truthful to test their case first than argue from a near-miss variant
[Reproduce a reviewer's EXACT codegen scenario before disputing — effects are use/lowering-dependent](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md).
The companion atom (slang#12922, naming six opaque builtins) names the underlying trap: a
`getTypeNameHint` case flips an empty hint to non-empty, which makes `addUserTypeHintDecorations`
emit a `-fspv-reflect` decoration — but that pass is gated on `as<IRGlobalParam>`, and it is
tempting to reason "these types lower away → never reach it → non-manifesting." That gate is
**necessary but not sufficient**: a *used* global RayQuery is copied to a local (no decoration)
while an *unused* one survives (decoration emitted), and `DescriptorHandle<T>` globals fold into
the parameter cbuffer (no string) while a `Texture2D` global is the control that does emit one —
verify the repro exercises the survival path or say "unverified," and note the effect here is real
but additive/benign (a documentation/optional-test item, not a bug)
[Reviewer trap: an IRGlobalParam gate doesn't prove a getTypeNameHint reflection side-effect is 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md).
The same discipline generalizes past codegen to ANY dispute a command can decide — and applies just as
much when YOU are the one being disputed. When a reviewer or codex critique flags a claim you made,
and the dispute is settleable by a binding grep, a `git merge-tree`, or reading a file at its CURRENT
head, run the command BEFORE writing a defense: a confident-sounding justification is not evidence. On
slangpy#1091/PR #1162 the author was tempted to defend two flagged claims; a 30-second check proved
codex right both times (a "needs a live Device+GPU" test was actually Python-bound and device-free; a
"merge stays clean" claim was refuted by `git merge-tree` finding real conflicts on shared files).
Corollary: always re-read a FAST-MOVING sibling PR at its current head, not from memory — its
diff/format/version changes under you (a sibling's signature format had been rewritten since a
5-week-old recollection); and for `git diff --name-only origin/main..<stale-branch>` a branch weeks
behind main lists mostly main's OWN drift the branch lacks, so identify the files BOTH branches modified
(or use `merge-tree`) rather than inferring "they conflict everywhere". Naming the failure mode ("I
should verify") does not inoculate you — only the tool call does
[when a reviewer disputes your claim with a runnable check, run it before defending](../learnings/1789423550516-when-a-reviewer-disputes-your-claim-with-a-runnabl.md).

## Self-raised findings, EXIT=0, and the full file list

As the reviewer, do not close a finding YOU raised on the author's self-reported result you
cannot reproduce. On slang#12921 the reviewer raised C001 (does excluding extension conformances
re-open the cross-module #12917 bug?) and closed it on the fixer's "EXIT=0 — extension cases
compile clean" — which the codex OUTPUT_REVIEW gate correctly caught: EXIT=0 proves the program
COMPILED, not that the witness resolves despite its visibility (the likely real mechanism:
`_getDefaultCtor` scans only DIRECT members, so an extension-declared conformance is never found
and the path falls through to a raw `DefaultConstructExpr`, never consulting witness visibility).
A green compile of the wrong-shaped test is not coverage of the shape you care about — keep the
finding OPEN as a recommended coverage/justification gap and spec the isolating test precisely.
That atom also frames critique-gate discipline: it is load-bearing not ceremony (delivery of
`[Resolution]`/`[Review Verdict]` markers is DENIED until an OUTPUT_REVIEW records approve, via
the EXACT protocol), and you MAY justify-and-decline where the critic is wrong (bot reviews are
COMMENT-only and never gate a human merge) while conceding immediately where it's right — don't
concede reflexively to clear the gate, and don't dig in where you're actually wrong
[Reviewer discipline: don't close a self-raised finding on the author's unverifiable EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md).
Finally, a review-fixes commit needs a full **file-list** spot-check, not just its code hunks:
on slang#12931 an "address review" commit also `git add`'d `.pr-body-12929.md` (the author's
PR-body scratch file) to the repo root — a tracked, stale, CLAUDE.md-violating merge-blocker no
code review catches — so scan every touched-file list for non-source artifacts (`.pr-body*.md`,
scratch `.md`, dotfiles, `*.log`), especially on follow-up commits where a broad `git add .`
sweeps them up, and verify a claimed fix by reading the actual new commit rather than the
description
[Re-check the full file list of post-review fix commits — scratch commits slip in](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md).

The automated stack has a **false-negative floor on subtle ABI/legalization correctness**. On slang PR #12875 (AnyValue bulk-copy of autodiff backward-context structs — the same subsystem as the AnyValue review lens above) the *entire* stack — slang-reviewer's 3-reviewer pass + CodeRabbit + an independent bot review + the codex PLAN/CODE/OUTPUT gates — returned APPROVE with 0 correctness bugs and the PR was reported "clean, awaiting merge." The maintainer's own (GPT-5-assisted) deep review then found two real bugs the stack missed: an ABI-preserved empty member (zero-leaf but carrying ExternCpp/Public/BinaryInterfaceType) must NOT be treated as byte-compatible, and a user `bit_cast<Word>(Empty{})` was silently zero-filled where the empty-source zero-fill needed to be provenance-gated (only the marshalling pass's own whole-object casts take it; an unmarked user cast must stay a loud failure). Both verified against master (loud `E99997`) vs the naive gate (silent `Word{0}`). Treat a clean automated pass on a byte-compatibility / type-legalization PR as *not yet proven*, and apply the numeric-exercise lens harder there ([maintainer's own deep review caught correctness bugs the automated review stack missed on slang#12875](../learnings/1789475349530-maintainer-s-own-deep-review-caught-correctness-bu.md)).

Two durable-text disciplines that cost avoidable review round-trips, both caught by codex OUTPUT_REVIEW: **(1) never cite `file.cpp:NNNN` in source comments, PR descriptions, or review replies** — a maintainer merging master into the branch shifts every line number, so refer to code by **stable symbol names** (`SemanticsDeclBasesVisitor::visitEnumDecl`, `_calcInheritanceInfo`); line numbers are fine only in ephemeral scratch/logs. **(2) `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` matches message text as a plain substring** — `{{.*}}` FileCheck regex is NOT supported and silently fails (0/1) — and the CHECK must be specific enough to reject the buggy variant (`//CHECK: cyclic reference '$inheritance'` naming the symbol, not the loose `//CHECK: cyclic reference` which also matches a wrong `'E'` diagnostic and wouldn't catch a revert) ([never cite file.cpp:line in durable text — merges make it stale; use stable symbol names; DIAGNOSTIC_TEST is substring-only](../learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md)).

**Source learnings (12):**
- [Review lens: AnyValue bulk-copy / empty-struct legalize — numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md) — dispatch the target conformer + pin its numeric result; assert the AnyValue invariant so the silent-default doesn't swallow other shapes.
- [Review lens: a threaded/recursive parameter — revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md) — delete the parameter and check a test fails; the deeper nested path is the untested one; silent miscompile risk.
- [Reproduce a reviewer's EXACT codegen scenario before disputing](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md) — unused vs used + -emit-spirv-directly flip the result; run codex's literal case, not a near-miss variant.
- [Reviewer trap: an IRGlobalParam gate doesn't prove 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md) — a static survive-gate is necessary not sufficient; exercise the survival path or say unverified; effect is additive/benign.
- [Reviewer discipline: don't close a self-raised finding on the author's unverifiable EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md) — EXIT=0 proves compile not mechanism; keep the gap open; justify-and-decline vs concede on the critique gate.
- [Re-check the full file list of post-review fix commits — scratch commits slip in](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md) — scan touched files for non-source artifacts (.pr-body*.md, logs); verify a claimed fix by reading the new commit.
- [Reviewing 'reject unrepresentable input' fixes: check sibling layout-query sites](../learnings/1789396536261-reviewing-reject-unrepresentable-input-fixes-check.md) — slang#13063 R1; a guard at one `getNaturalSizeAndAlignment` site left `kIROp_Var`/`kIROp_Store` pointee queries unguarded; grade Gap not Bug if reachability unverified; A catches it, B/C rarely do.
- [Round-2 review of a 'factored guard into shared helper' fix: doc-overstatement + defensive guards](../learnings/1789401172349-round-2-review-of-a-factored-guard-into-shared-hel.md) — slang#13063 R2; check the helper doc doesn't overstate coverage, mark removal-insensitive guards defensive (don't demand removal on a final round), surface A-vs-C comment-accuracy disagreements; R1 REQUEST_CHANGES → R2 nits-only = APPROVE_WITH_NITS.
- [When a reviewer disputes your claim with a runnable check, run it before defending](../learnings/1789423550516-when-a-reviewer-disputes-your-claim-with-a-runnabl.md) — slangpy#1091/PR #1162; a decidable dispute (grep, `git merge-tree`, read-at-head) is settled by the command, not a confident justification; re-read fast-moving siblings at current head.
- [slang-rhi review lens: pooled staging + RAII free + fallible queue-wait = in-flight page reuse](../learnings/1789444437478-slang-rhi-review-lens-pooled-staging-raii-free-on-.md) — slang-rhi#869; OOM ≠ device loss, RAII frees pooled staging with no fence → torn data on a later sequential readback; "mirror readTexture" re-trips the `m_totalUsed==0` assert; run the critique gate on the verdict.
- [maintainer's own deep review caught correctness bugs the automated stack missed on slang#12875](../learnings/1789475349530-maintainer-s-own-deep-review-caught-correctness-bu.md) — full stack (3 reviewers + CodeRabbit + bot + codex gates) APPROVEd 0 bugs; maintainer found ABI-empty-member byte-incompat + ungated `bit_cast` zero-fill; treat a clean pass on ABI/legalization PRs as not-yet-proven.
- [never cite file.cpp:line in durable text; use stable symbol names; DIAGNOSTIC_TEST is substring-only](../learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md) — merges shift line numbers so cite symbols; `//DIAGNOSTIC_TEST` matches text as a plain substring (`{{.*}}` unsupported), so make the CHECK reject the buggy variant.
