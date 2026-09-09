---
title: Correctness-review methodology — coverage lenses, codegen reproduction, and self-finding discipline
type: concept
group: review-process
tags: [reviewer, review-lens, revert-drill, positive-control, codegen-reproduction, use-dependent, exit-0, self-raised-finding, file-list, silent-miscompile]
source_count: 6
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

**Source learnings (6):**
- [Review lens: AnyValue bulk-copy / empty-struct legalize — numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md) — dispatch the target conformer + pin its numeric result; assert the AnyValue invariant so the silent-default doesn't swallow other shapes.
- [Review lens: a threaded/recursive parameter — revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md) — delete the parameter and check a test fails; the deeper nested path is the untested one; silent miscompile risk.
- [Reproduce a reviewer's EXACT codegen scenario before disputing](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md) — unused vs used + -emit-spirv-directly flip the result; run codex's literal case, not a near-miss variant.
- [Reviewer trap: an IRGlobalParam gate doesn't prove 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md) — a static survive-gate is necessary not sufficient; exercise the survival path or say unverified; effect is additive/benign.
- [Reviewer discipline: don't close a self-raised finding on the author's unverifiable EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md) — EXIT=0 proves compile not mechanism; keep the gap open; justify-and-decline vs concede on the critique gate.
- [Re-check the full file list of post-review fix commits — scratch commits slip in](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md) — scan touched files for non-source artifacts (.pr-body*.md, logs); verify a claimed fix by reading the new commit.
