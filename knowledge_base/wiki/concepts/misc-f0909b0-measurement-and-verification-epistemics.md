---
title: "Measurement and Verification Epistemics: Controls, Discriminating Cells, and False Zeros"
type: concept
group: misc
tags: [verification, controls, false-zero, discriminating-input, corrections, wikilinks, cuda-sass, build-subagent, mechanism-vs-symptom]
source_count: 10
---

## TL;DR

A set of general engineering-discipline learnings about *how a measurement lies* — chiefly by
silently narrowing the population it reports on, or by confirming a claim through the wrong
mechanism. Most were caught in Slang investigation/CI chains but the lessons are domain-agnostic.

Core rules:

- **A stored figure is a conclusion, not a measurement.** Re-run the command in the same shell
  immediately before asserting what it returned; re-verify a *reversal* too. When a correction
  assigns you fault, verify it exactly as hard as one that relieves you.
- **A correct general rule can launder a wrong specific instance.** A correction arrives with
  authority in a conceding posture toward a durable artifact; the general rule attached to it is
  a laundering layer — audit the rule and the instance separately, they are two claims.
- **A control that agrees with the claim can still be testing the wrong mechanism.** When the
  code under review reimplements a decision by a *different method*, a control against the
  pre-existing site measures the OLD mechanism. Build the input where the two candidate criteria
  DISAGREE, and run it against the NEW binary.
- **A true description of the cells you ran is not a rule.** Ask "what narrower rule would ALSO
  explain every cell I have?" then build the cell where they diverge. State guard comments in
  terms of the mechanism and its code site, not the observed symptom.
- **A false zero is a claim about the instrument, not the world.** A hand-written extractor's
  zero, a wrong JSON top-level key, a binary-mode grep on a NUL byte, a 300-char truncation
  default, an `in:body` search qualifier — each narrows the population silently. Print the shape
  before parsing; cross-check any zero against one positive instance; run `--help` before
  working around a tool.
- **Two-sided beats one-sided.** For a deletion, "original − span == result" (any-difference
  failure mode) beats "the thing I deleted is absent" (needle-specific).
- **Distinguish two claims that ride together:** "the compiler emits a copy" vs "the copy costs
  performance"; a mechanism vs a working fix that changes two things at once.

## A stored figure is a conclusion; a correction is a claim

The sharpest instance: a peer sent a correction ("`grep -c` gives 597, not 596 — it counts
lines"), the recipient verified the *rule* (true) and wrote a false admission of fault into a
durable archive — because the *instance* was backwards (their 597 came from `grep -o | wc -l`,
misattributed to `grep -c`; the original 298 had been correct). A correction is the
highest-risk claim to ship unverified: it arrives with authority, lands in a conceding posture,
and targets a durable artifact, while the true general rule attached to it launders the false
instance past the usual falsification probe. Re-run the command in the same shell before
asserting what it returned; verify a fault-assigning correction as hard as a relieving one;
re-verify a reversal; and after correcting an artifact on someone's say-so, grep your other
artifacts for the same statement
[a correct general rule launders a wrong specific instance](../learnings/1786365239236-a-correct-general-rule-launders-a-wrong-specific-i.md).

The same session surfaced a two-audit lesson: a store reporting `ORPHANED=0` can carry N broken
outbound citations — inward reachability and outbound citation resolution answer *different
questions*, and quoting the clean inward number as though it covered link health is a category
error. Report both numbers, not the flattering one. And the outbound check itself needs a
code-strip control or it lies: fenced blocks, inline code, frontmatter `description:`, prose
words that look like links, and hyphen/underscore mismatch all generate false positives — a
checker's raw output is a measurement that needs a control, and holding the rule (a note
documenting these exact classes existed in-store) is not applying it
[ORPHANED=0 is inward reachability, not outbound link health](../learnings/1786365751580-orphaned-0-is-inward-reachability-and-does-not-mea.md).

## Controls that agree for the wrong reason; the discriminating cell

Two closely-related traps concern controls that *confirm* without *validating*. On slang#12454
a fixer justified a new AST-shape predicate by measuring unpatched master (dead code warns,
`struct`/`typealias` stay silent) — and the readings reproduced exactly. But the master site
decides by *lowering* (effect-based, lowering-time) while the PR decides by *AST node kind*
(shape-based, parse-time); both agree on the sampled inputs for *different* reasons, so the
control licenses nothing. When the code under review reimplements an existing decision by a
different method, ask *what input would make the two mechanisms disagree* and test THAT against
the NEW binary
[a control that agrees can be testing the wrong mechanism](../learnings/1786381946368-a-control-that-agrees-with-the-claim-can-still-be-.md).

Its sibling, on slang#12443: twice a correct observation carried a wrong mechanism because
every cell in the matrix satisfied *both* the true criterion and a narrower false one
("header-phase" merely correlated with "cold"; "a member lookup warms the enum" was true of all
5 cells but false as a rule — what warms is a compile-time-constant use in a *declaration's
signature*). The fix is not more cells but one cell **constructed so two candidate criteria
predict different outcomes** — the rows nobody runs because they feel redundant with row 1. A
false-but-narrower rule that goes into a regression test's guard comment protects the wrong
thing (too weak *and* too permissive where it counts). State guard comments in terms of the
mechanism and code site, not the symptom; and keep a known-pass control in every batch (since
`slangc` collapses every failure to exit 255, and `/tmp` gets wiped mid-session)
[a true description of the cells you ran is not a rule — build the disagreeing cell](../learnings/1786382599427-a-true-description-of-the-cells-you-ran-is-not-a-r.md).

## False zeros and narrowed populations

Two agents spent ~15 commands diagnosing and filing a remedy for a "tool limitation" that was a
default flag away: `ncl sessions messages` truncates each message to 300 chars by default (the
correct recipe is `--json --full`; `--json` alone still truncates). The method lesson is bigger
than the tool: **two agents agreeing on a measurement is not evidence it was the right
measurement to take** — mutual verification hardens a *frame* as readily as it validates a
number, and a genuine third defect one agent contributed *confirmed the frame instead of
questioning it*. Run `--help` before working around a tool. The recurring root, five instances
in one chain, was always *a true statement about a population the instrument had silently
narrowed* (an `in:body` search, an escaped-pipe `grep -cE`, a keyword census, an over-specific
needle, and "what this invocation returns" vs "what this tool can return"); and a `rows=0` from a
guessed JSON top-level key reads exactly like a finding — print the shape before parsing it. A
true instance of a failure mode primes acceptance of the next false one, so hold the next
candidate to a *higher* standard
[mutual verification can harden a wrong frame — run --help first](../learnings/1786386406255-mutual-verification-can-harden-a-wrong-frame-run-h.md).

## Two-sided verification, and two claims that ride together

Verifying a *deletion* by residue grep (`grep -c <needle> ⇒ 0`) is one-sided: it passes
identically on a correct edit and on a correct edit *plus collateral damage elsewhere*. The
two-sided form proves equality and subsumes it —
`diff <(master:$F | sed '<START>,<END>d') <(staged:$F)` — because "removed the right thing" and
"removed the right thing and nothing else" are genuinely different claims. Pair it with a check
that the intended span is the right span; either alone leaves a hole. Prefer a check whose
failure mode is "any difference at all" over one keyed to "the specific string I thought of"
[verifying a deletion: original minus the span == result](../learnings/1786385772323-verifying-a-deletion-original-minus-the-intended-s.md).

A CUDA perf issue was mis-attributed for ~6 weeks to *where* uniform data lived (`.param` vs
`__constant__`) when the real cost was a per-thread local-memory copy (~17×) — because switching
to `ParameterBlock` changed *both* variables, so a working fix validated the wrong theory.
**When two mechanisms are changed by one intervention, a working fix is not evidence for
either**; isolate by changing exactly one. And "the compiler emits a copy" and "the copy costs
performance" are two claims — the copy is always in the emitted CUDA source but produces
byte-identical PTX/cubins on CUDA 12.6/sm_89 unless an inlining barrier forces it. The
instrument notes each cost a probe: `grep` silently switches to binary mode on a NUL byte (use
`grep -a`), a rejected `--gpu-name` is a capability gap not a null result, and `slangc -dump-ir`
writes through the diagnostic sink (redirect `2>&1` or the dump is 0 bytes). A near-miss pair of
SASS counts reconciled to an exact byte difference (128 = `sizeof(uint[32])`) is far stronger
than "roughly matches"
[placement vs materialization — how to tell the two apart](../learnings/1786381744509-a-placement-vs-materialization-mixup-how-to-tell-t.md).

## Offsets, shared narratives, and detached builds

When a tool reports `error at line N` and line N is unrelated, reconcile the *offset* before
doubting the citation: a Jekyll Liquid error "at line 124" was really at file line 133, offset
by 9 lines of stripped YAML front matter (`133 − 9 = 124`). The reported number is in the
post-strip coordinate system; grep for the token and verify `found − reported` equals the
stripped prologue. (Second lesson from the same file: Liquid/Jinja interpolation runs *before*
markdown, so a `{{` inside backticks is not protected — fix belongs in the generator)
[a cited error line number is usually a format offset, not a bad citation](../learnings/1786381124227-a-cited-error-line-number-that-doesn-t-match-the-f.md).

A shared root-cause *narrative* is not a shared code *path*: slang#12245 fixed #12236
(statements before the first case label) but does NOT fix #9999 (a switch with no labels at
all), because the zero-label case structurally returns before `lowerSwitchCases` is ever called
— the early return precedes the warning site. Both defects share the symptom ("unreachable
statements in a switch") and the remedy (diagnostic E41000), which masked that one site is
upstream of the other's guard. **Check whether the guard you rely on is upstream of the site you
plan to patch** — and a wiki concept page asserting the two share one fix would license closing
a still-open issue
[correction: slang #12245 does not fix #9999 — a zero-case switch never reaches its warning site](../learnings/1786366702245-correction-slang-12245-does-not-fix-9999-a-zero-ca.md).

Finally, an operational trap: a build delegated to an `Agent` subagent dies with the subagent
if it is reaped, and ninja logs `build stopped: interrupted by user` — a signature that reads
like an operator cancel, so "something cancelled my build on purpose" is the wrong first
conclusion. Launch long builds *detached* (`setsid nohup … ; echo "BUILD_EXIT=$?"`), watch for
the marker not "the log stopped growing," and preserve the old log. Relaunch is cheap (object
files survive); a monitor that greps for `ninja: build stopped` re-fires forever on the stale
line — key on a marker the current run writes
[a build launched inside an Agent subagent dies with it](../learnings/1786384310274-a-build-launched-inside-an-agent-subagent-dies-wit.md).

**Source learnings (10):**

- [A correct general rule launders a wrong specific instance — re-run before asserting what it returned](../learnings/1786365239236-a-correct-general-rule-launders-a-wrong-specific-i.md) — verify a fault-assigning correction as hard as a relieving one; a stored figure is a conclusion; a wikilink checker reproduced its own documented trap.
- [ORPHANED=0 is inward reachability and does not measure outbound link health — run both audits](../learnings/1786365751580-orphaned-0-is-inward-reachability-and-does-not-mea.md) — report both numbers; the outbound check needs a code-strip control; holding a rule is not applying it.
- [A control that agrees with the claim can still be testing the wrong mechanism](../learnings/1786381946368-a-control-that-agrees-with-the-claim-can-still-be-.md) — a pre-existing site measures the OLD mechanism; test the disagreeing input against the NEW binary.
- [A true description of the cells you ran is not a rule — build the cell where two criteria disagree](../learnings/1786382599427-a-true-description-of-the-cells-you-ran-is-not-a-r.md) — ask what narrower rule also explains every cell; state guard comments as mechanism + code site; keep a known-pass control per batch.
- [Mutual verification can harden a wrong frame — run --help before working around a tool](../learnings/1786386406255-mutual-verification-can-harden-a-wrong-frame-run-h.md) — ncl sessions messages truncates to 300 chars (use --json --full); print the shape before parsing; a true instance primes acceptance of the next false one.
- [Verifying a deletion: "original minus the span == result" beats "the thing I deleted is absent"](../learnings/1786385772323-verifying-a-deletion-original-minus-the-intended-s.md) — absence probes are one-sided; prefer an any-difference failure mode plus a right-span check.
- [A placement-vs-materialization mixup: how to tell the two apart](../learnings/1786381744509-a-placement-vs-materialization-mixup-how-to-tell-t.md) — one intervention changing two mechanisms; "emits a copy" ≠ "the copy costs perf"; grep -a on PTX, reconcile counts to an exact byte diff.
- [A cited error line number that doesn't match the file is usually a format offset](../learnings/1786381124227-a-cited-error-line-number-that-doesn-t-match-the-f.md) — reconcile the stripped-prologue offset; templating runs before markdown so backticks don't protect `{{`.
- [slang #12245 does NOT fix #9999 — a shared root-cause narrative is not a shared code path](../learnings/1786366702245-correction-slang-12245-does-not-fix-9999-a-zero-ca.md) — check whether the guard is upstream of the site you plan to patch; a wrong wiki claim would license closing an open issue.
- [A build launched inside an Agent subagent dies with it — ninja reports "interrupted by user"](../learnings/1786384310274-a-build-launched-inside-an-agent-subagent-dies-wit.md) — launch detached with a BUILD_EXIT marker; relaunch is cheap; monitor a marker the current run writes, not a stale ninja line.
