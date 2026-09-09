---
title: "Challenger Review Probes: Sweeps, Classifiers, Refcounts, Concurrency, and Census"
type: concept
group: agent-infra
tags: [approver, challenger, review-probes, verification, refcount, concurrency, decoration-census, classifier]
source_count: 6
---

## TL;DR

Transferable verification probes an approver's challenger (and any careful reviewer) should
run before clearing or blocking. The through-line: a green result that nothing had to work to
produce carries no information — ask of every pass, *could this have come out otherwise?*

- **A collision/uniqueness sweep must run WITHIN each namespace, not only ACROSS them.** "Do
  A and B collide?" and "is A internally unique?" are independent questions; the cross-namespace
  framing makes the second invisible. Print both directions (`comm -12` across;
  `sort | uniq -d` within). Finding enough evidence to decide is not finishing the measurement.
- **A negative branch reached by FALL-THROUGH is the least trustworthy result any check can
  produce** — nothing had to work for it to print. Never let `else` mean "healthy"; give the
  classifier an explicit `❓ UNKNOWN` fall-through. Test a classifier with a known-bad AND a
  known-good input before believing either verdict. Never truncate a body you pattern-match.
- **Void evidence returns to UNKNOWN, not to your prior reading** — a result from a broken
  instrument becomes absent, and the probe must be re-run.
- **For a refcount/orphan-sweep teardown PR, count the reference BUDGET**: creates (creation +
  each retention addRef) vs releases (recorded-release + sweep-note + each owner's clear).
  Enumerate every OTHER owner of a swept object; a replayed `release()` on a doubly-held proxy
  drops 2→1 (not to 0), so the refcount-0-only self-destruct scrub never fires.
- **When a change adds memory-ordering to a previously-plain link, the unit of audit is EVERY
  reader** — container iterators, `begin()`/`end()`, range-for sugar, open-coded `->next` — not
  just the named accessors the author converted. `end()` is a read; range-for caches it once.
- **Verify the default state and target set before rating a concurrency race** — "green on the
  runners we have" (x86 makes an acquire load a plain `mov`) is not "correct on the targets we
  ship" (ARM64 `ldar`).
- **A stack-limit sweep does not establish recursion** — `rc=139` invariant under a growing
  `ulimit -s` is equally consistent with an OOB read. Use a frame census, frames-vs-buffer, and
  `si_addr` region. A "Debug-only assert" can hide a Release crash on the next line; test the
  composed shape.
- **A per-origin gate's carrier census must sweep BOTH the IR-decoration producers AND the
  AST-attribute-synthesis layer.** An exclusion list is an OPEN producer enumeration that fails
  silently; a producer-decouple is a CLOSED consumer enumeration that fails loud.
- **Audit mechanisms separately from conclusions** — a wrong mechanism under a correct
  conclusion draws no pushback from outcomes.

## Synthesis

### Sweeps and classifiers: measure the question you actually asked

Two probes concern the reliability of a check's own output. First, uniqueness is a
per-namespace property, so a collision sweep must interrogate each namespace against itself,
not only against its peers. Investigating a lint that keyed on diagnostic code, one pass found
13 cross-family collisions and stopped — the DECISION_REVIEW critique surfaced that the lua
table collides with *itself* far harder (code 39999 carries 27 distinct diagnostics, 99999
carries 6), so ~33 diagnostics share 15 codes and a one-row-per-code store cannot represent the
class at all ([a collision sweep must run WITHIN each namespace](../learnings/1786383794646-approver-critique-mustfix-a-collision-sweep-must-r.md)).
The framing "do the two namespaces collide?" silently answers "is each internally unique?" with
*yes* without testing it — run both directions (`comm -12` across; `sort | uniq -d` within, or a
`defaultdict(list)` per source) and print both. The corollary is broadly useful: **finding
enough evidence to decide is not the same as finishing the measurement** — when a probe crosses
the decision threshold early, severity, blast radius, and the *shape* of the fix all live in the
part you were about to skip. Also report which collisions are *reachable* (a sentinel `-1` absent
from the snapshot is unreachable by the lint) so the claim is checkable.

Second, and structurally identical: a negative branch reached by FALL-THROUGH is the least
trustworthy result any check can produce, because nothing had to work for it to print. A peer's
classifier keyed on `head -c 120` of a `gh` body, but the `app_not_connected` marker sits at
char 139 — so truncation dropped it and control fell through to the success branch, printing
`OK/injected` for six endpoints including two definitively broken ones
([a negative branch reached by FALL-THROUGH is the least trustworthy result](../learnings/1786399134104-approver-critique-miss-a-negative-branch-reached-b.md)).
Worse, a self-audit found the same latent defect: the `✅ INJECTED` branch tested only "does the
body parse as JSON" — but the short-circuit body IS valid JSON, so the branch is correct only
because the `app_not_connected` test runs first; reorder two `elif`s and every failure reads as
success. The rules: never let `else` mean "healthy" (give an explicit `❓ UNKNOWN` fall-through);
test a classifier with a known-bad AND known-good input before believing either verdict; never
truncate a body you pattern-match; and **void evidence returns to UNKNOWN, not to your prior
reading** — a result from a broken instrument is absent, not its opposite, and the probe must be
re-run.

### Refcount and concurrency probes for teardown / memory-ordering PRs

For a record-replay orphan-sweep BLOCK (slang#12449), the transferable probe is a **reference
budget**: a playback-created proxy can be held by two owners (the orphaned creation reference the
sweep tracks, and a separate retention list via a non-attach ComPtr), so a replayed `release()`
drops it 2→1 (not to 0) — the refcount-0-only self-destruct scrub never fires, the note survives,
and teardown's later release frees the proxy while the retention list still dangles → use-after-
free ([replay teardown orphan-sweep can double-free a retained proxy](../learnings/1786466442308-approver-challenger-probe-replay-teardown-orphan-s.md)).
The steps generalize to any orphan-sweep/refcount-teardown PR: enumerate every OTHER owner of a
swept object; check whether its `release()` is on the replayed/recorded path (grep the handler-
registration table); check sweep ORDER vs ownership (youngest-first frees a child before its
parent owner); and count creates vs releases — more releases than creates ⇒ over-release. The PR's
own test missed it by modeling only the no-recorded-release case, and the author's accounting
comment silently assumed that case; two independent bot 🔴s + a source-verified budget held the
BLOCK against a lone human approve.

For a concurrency BLOCK (slang#12446), the audit unit is EVERY reader of a link that gained
memory-ordering, not the named accessors the author converted. The author made
`getFirst/Next/LastDecoration` acquire but left the container iterator plain, and `end() =
last->next` plain-reads the exact release-store slot; C++ range-for evaluates `end()` once, so an
interleaving walks into the freshly-published body ([concurrency BLOCK: partial acquire/release conversion](../learnings/1786502900915-approver-challenger-concurrency-block-pattern-a-pa.md)).
Container iterators, `begin()`/`end()`, range-for sugar, and open-coded `->next` walks are readers
too — usually the hottest. `end()` is a read; check the sentinel computation, not just the step.
A concurrency 🔴 needs a reachability gate (shared across threads AND the racy path taken — here a
sibling commit flipped the lazy path to default-on), and severity is about the CODE not the
toolchain: x86 makes an acquire load a plain `mov` so the race is invisible on x86 CI, but ARM64
(`ldar`) is a supported target — "green on the runners we have" is not "correct on the targets we
ship."

### A crash's mechanism, and a decoration census across layers

Two probes are about not mistaking one mechanism for another. A stack-limit sweep does NOT
establish recursion: `rc=139` invariant under a 32× growing `ulimit -s` is equally consistent
with an out-of-bounds read (an OOB read faults at the same address regardless of stack size)
([a stack-limit sweep does not establish recursion](../learnings/1786411828967-a-stack-limit-sweep-does-not-establish-recursion-3.md)).
Three cheap discriminators from one `LD_PRELOAD` SIGSEGV handler + `backtrace()`: a frame census
(`grep -oE '\+0x[0-9a-f]+' | sort | uniq -c` — real recursion repeats one offset dozens of times;
mine appeared 2×), frames-vs-buffer capacity (36 of 64 returned ⇒ not saturated ⇒ not recursion),
and the `si_addr` region (heap/mmap `0x55/0x56` under PIE ⇒ bad pointer arithmetic; stack overflow
faults on the guard page near `0x7ff`). The independent second lesson: a "Debug-only assert" can
hide a Release crash on the next line — `SLANG_ASSERT → SLANG_ASSUME → __builtin_unreachable()`
licenses dropping an empty-range guard, so the Release question is "what does the code after the
assert do with the state the assert denied?" Test the composed shape, and pair every crash cell
with controls that vary only the suspect construct. The meta: the wrong mechanism sat under a
*correct* conclusion (the crash was real), the class that draws no pushback from outcomes — audit
mechanisms separately from conclusions.

Finally, a per-origin gate's carrier census must sweep BOTH layers. Enumerating IR-decoration
producers (`addForceInlineDecoration`) found 2 sites and looked "exhaustive," but missed a THIRD
carrier: code that synthesizes the AST attribute itself (`addModifier(synAccessorDecl,
create<ForceInlineAttribute>())`), which flows through ordinary lowering into an indistinguishable
generic decoration ([a decoration-origin census must sweep the AST-attribute-synthesis layer](../learnings/1787157291110-correction-a-decoration-origin-census-must-sweep-t.md)).
When a gate keys on the ORIGIN of a decoration lowered from an AST attribute, grep BOTH the IR
layer (`add*Decoration`) and the AST-synthesis layer (`create<XAttribute>()`,
`addModifier(..., create<XAttribute>())`, `new XAttribute`). The design consequence:
**producer-decouple beats stamp-time exclusion** — an exclusion list (`{setter, constexpr,
synth-accessor}`) is an OPEN producer enumeration that grew 2→3 mid-review and fails silently (a
4th piggyback re-breaks codegen with no error), whereas making the compiler's correctness-inline
carry its OWN generic decoration and gating `marker ∧ ¬generic` is a CLOSED, grep-verifiable
CONSUMER enumeration that fails loud (a missed reader makes a user func stop inlining →
test-visible). This requires "replace" not "supplement," and a narrow purpose-built modifier over
a coincidental `loc`-validity proxy or a broadly-read shared `SynthesizedModifier`.

**Source learnings (6):**
- [A collision sweep must run WITHIN each namespace, not just ACROSS them](../learnings/1786383794646-approver-critique-mustfix-a-collision-sweep-must-r.md) — uniqueness is per-namespace; print both directions; finding enough to decide isn't finishing the measurement; report reachable collisions.
- [A negative branch reached by FALL-THROUGH is the least trustworthy result any check can produce](../learnings/1786399134104-approver-critique-miss-a-negative-branch-reached-b.md) — never let `else` mean healthy; test with known-bad+known-good; never truncate a matched body; void evidence → UNKNOWN.
- [Replay teardown orphan-sweep can double-free a retained proxy — check for a SECOND owner](../learnings/1786466442308-approver-challenger-probe-replay-teardown-orphan-s.md) — the reference budget (creates vs releases) is the clincher; a replayed release drops 2→1 so the refcount-0 scrub never fires.
- [Concurrency BLOCK — partial acquire/release: the container iterator + end() stay racy](../learnings/1786502900915-approver-challenger-concurrency-block-pattern-a-pa.md) — audit EVERY reader of a newly-ordered link; `end()` is a read range-for caches once; verify default-on state and ARM64, not x86 CI.
- [A stack-limit sweep does not establish recursion — 3 discriminators for SIGSEGV vs stack overflow](../learnings/1786411828967-a-stack-limit-sweep-does-not-establish-recursion-3.md) — frame census, frames-vs-buffer, `si_addr` region; a Debug assert can hide a Release crash on the next line — test the composed shape.
- [A decoration-origin census must sweep the AST-attribute-synthesis layer too](../learnings/1787157291110-correction-a-decoration-origin-census-must-sweep-t.md) — grep both IR producers and AST synthesis; producer-decouple (closed consumer enumeration, fails loud) beats an open exclusion list.
