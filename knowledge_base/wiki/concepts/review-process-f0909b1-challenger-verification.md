---
title: The Step-3 challenger — verifying reviewer findings against source before they drive a verdict
type: concept
group: review-process
tags: [approver, challenger, false-positive, verify, block, source-trace, pre-existing, mechanism, inheritance, reachability]
source_count: 14
---

## TL;DR

A bot reviewer's finding (Devin 🔴, CodeRabbit 🟠, a codex critique HIGH) is a CLAIM, not proof.
The Step-3 challenger's job is to verify the claim's mechanism against the actual source at the
pinned head before it can drive BLOCK — and, symmetrically, before it can be dismissed as "false."
Both directions have a hard discipline the critique gate repeatedly had to enforce.

Recurring verification failures and the probes that catch them:

- **Attribution before severity.** A reviewer flags the CURRENT state of a touched line, not the
  delta. Diff the flagged line against base: INTRODUCED/WORSENED ⇒ 🔴 candidate; byte-identical
  mechanical change (rename/`.get()`-strip) ⇒ PRE-EXISTING, not a BLOCK.
- **Verify the mechanism, not adjacent artifacts.** To refute a finding that cites a NAMED
  rule/doc/policy, open THAT exact source and read the clause — grepping neighbors or reasoning
  from a precedent's absence is not verification.
- **Trace the inheritance / Super:: chain.** A "missing case" in a derived C-like emitter is
  usually intentional delegation to the base, not a bug — resolve `tryEmitInstExprImpl`'s tail.
- **Check the sibling the PR says it matches.** A removed reset/cleanup flagged as a leak is not
  novel if the reference implementation has the same no-reset by design.
- **Enumerate PRODUCERS for reachability, and FAILURE/early-return exits + the persistence API for
  escape.** A guard that fires in release on an "unreachable-today" value is fatal-by-construction.
- **A clean bot verdict is a prior conditioned on the bot having read the change correctly** —
  falsify that condition first (does its summary match the diff's load-bearing facts?).
- **Include-resolution and CI-blindness:** an "include won't resolve" claim must enumerate ALL
  include dirs (PUBLIC/INTERFACE propagated), and diff-scoped reviewers structurally miss companion
  tests in unchanged files.

**The invariant that outranks all of it:** a challenger's verification can only ADD CAUTION. It may
never UPGRADE a doc's 🔴 to WOULD_APPROVE, and it may not record BLOCK on a finding it has DISPROVEN.
A finding that is spurious-but-unclearable, or real-but-a-defensible-tradeoff, resolves to
ABSTAIN_POLICY (CHALLENGER_CONCERN / OPEN_GAP), which routes to a human. (The never-round-up rule and
its ABSTAIN taxonomy are developed on the approver-decision-policy page.)

## Attribution: a reviewer flags the touched line's current state, not the delta

On slangpy#1108 CodeRabbit posted a real, reachable 🟠 Major (unsigned-promotion OOB on a negative
EXR data-window origin) — but the PR changed that exact line only mechanically (`m_data.get()` →
`m_data`); the offset arithmetic and allocation size were byte-identical to base. A reviewer bot
flags the current state of a touched line, not the introduced delta
([reviewer finding on a mechanically-touched line: check attribution before block-vs-abstain-vs-approve](../learnings/1786694508257-approver-challenger-miss-reviewer-finding-on-a-mec.md)).
Classify with `gh pr diff` in one line: INTRODUCED/WORSENED ⇒ 🔴 → BLOCK candidate; behavior
byte-identical mechanical change ⇒ PRE-EXISTING (the diff neither adds the trigger nor enlarges blast
radius nor removes a guard). A pre-existing real+reachable Major is NOT a BLOCK but also does not
auto-clear — on the fallback tier it routes to ABSTAIN_POLICY:OPEN_GAP, and the attribution
("pre-existing, mechanical change only") is recorded in the challenger field so the human-outcome
join stays interpretable.

## Verify the exact mechanism/rule — not an adjacent artifact

The recurring over-claim is refuting a finding from something NEAR the cited source rather than the
source itself. On slang#12378 Devin flagged "new compiler error added without the documentation
update the contribution rules require"; the challenger called it "verifiably false" from three
ADJACENT artifacts (a generated catalog marked "do not edit," a how-to doc, a sibling PR that also
skipped the rule) but never opened `CONTRIBUTING.md`, which at :362-368 states outright "update the
relevant documentation in the same PR." The finding was supported by policy — a precedent lacking the
artifact just means that PR also skipped the rule
([verifying a Devin bug as false requires opening the exact rule it cites — not adjacent artifacts](../learnings/1787684744187-approver-challenger-miss-verifying-a-devin-bug-as-.md)).
When a finding cites a named rule/doc/policy, the ONLY refutation is opening that exact source and
naming the file:line that contradicts it.

The empirical analogue: a critique can be directionally RIGHT (there is a real bug) but WRONG about
the mechanism/fix. On slang#12636 a codex CODE_REVIEW proposed an `as<IRParam>(image)` guard for an
"unprovable 64-bit stride"; reproducing with `slangc -dump-ir` showed a texture reached through a
function parameter carries an element-type-derived default `[format]`, so the guard sat in dead code —
both over-reaching and under-reaching, the tell that it is failing on an axis orthogonal to the defect
([verify a code-review critique's mechanism empirically before acting on it](../learnings/1787672413185-verify-a-code-review-critique-s-mechanism-empirica.md)).
And on slang#12503 a Devin fallback 🔴 ("internal helper still reachable from user code via `import
glsl;`") was refuted directly from the checker source — `isDeclVisibleFromScope` makes an `Internal`
decl visible only within the same module, so importing a module never grants access to its internal
members — and confirmed by building at head; but the disproof still only justified ABSTAIN, not
approval, because the finding self-contradicted Devin's own summary and the procedure bars upgrading
past a 🔴
([a self-contradicting Devin fallback 🔴 still forces ABSTAIN, not BLOCK or approval — verify by building at head](../learnings/1786983473416-approver-challenger-miss-a-self-contradicting-devi.md)).

## Trace inheritance and check the sibling

Two Slang-emitter-specific probes recur. **Resolve the Super:: chain** before honoring a "missing
case" 🔴: on slang#12688 Devin flagged CUDA leaving out a `FixedArray` brace for element-filled
arrays because the CUDA emitter had no `MakeArrayFromElement` case — but
`CUDASourceEmitter::tryEmitInstExprImpl` ends `return Super::tryEmitInstExprImpl(...)`, and its Super
(`CPPSourceEmitter`) handles the op with the brace, so element-filled CUDA arrays ARE braced via
fall-through. Grep the `.h` for `typedef ... Super;` and read the base's handling before treating a
missing case as a bug
([Devin flags a per-op missing brace without tracing the Super:: fall-through](../learnings/1787621185192-approver-challenger-miss-devin-flags-a-per-op-miss.md)).
The mirror-image reviewer heuristic: a PR that lifts a subclass override UP into a shared base changes
EVERY inheriting subclass — the same slang#12688 folded a WGSL-local `shouldFoldInstIntoUseSites`
override into `CLikeSourceEmitter`, silently changing HLSL/GLSL/Metal, and Metal was a real regression
(it spells arrays as the `metal::array<T,N>` struct-wrapper but didn't inherit the double-brace fix).
This class is mechanically auditable at source level — enumerate every inheritor and check its
downstream emit compatibility — even when the final verdict needs CI; separate the confirmed mechanism
from the unconfirmed outcome
([a PR that lifts a subclass override into a shared base changes EVERY inheriting subclass](../learnings/1787580519409-reviewer-heuristic-a-pr-that-lifts-a-subclass-over.md)).

**Check the sibling the PR says it matches** before treating a removed reset as a leak. On slang#12593
Devin raised a 🔴 that removing an HLSL-prelude reset lets an NVAPI prelude persist across tests — but
the sibling tool the fix explicitly converges toward (slang-test) sets the NVAPI prelude and never
resets it, by documented design, and the mutating branch is platform-gated (NVAPI unreachable on
Linux) with the affected tests green at head. A documented no-reset sibling refutes "novel defect"
([Devin flags a removed incidental prelude-reset as a 🔴 leak-forward bug when the sibling has the same no-reset by design](../learnings/1787611620922-approver-challenger-miss-devin-flags-a-removed-inc.md)).

## Reachability: enumerate producers, and enumerate escape paths

A guard that fires in RELEASE on a supposedly-unreachable value is fatal-by-construction. On
slang#12539 a debug-only `SLANG_ASSERT` was replaced by a loop-over-all-operands
`SLANG_RELEASE_ASSERT(attr==NoDiff||UNorm||SNorm)`; a complete enumeration of all attr-kind PRODUCERS
(the 3 frontend handlers + all 14 `getAttributedType` call sites) proved it unreachable today — so NOT
a verified reachable 🔴 (not BLOCK) — but fatal-by-construction on a "harmless" layout-transparency
property, with the PR's own process report arguing against the very whitelist the code implements, so
NOT WOULD_APPROVE either ⇒ OPEN_GAP for a human severity call. Enumerate the guarded value's PRODUCERS
to test reachability, not just its consumers; and note that pre-PR `SLANG_ASSERT` is `SLANG_ASSUME`/UB
in release, so an assert→release-assert change trades silent UB for a defined abort, not a clean
regression
([a RELEASE-fatal assert on a layout-transparent property is OPEN_GAP not BLOCK when unreachable-by-current-producers but fatal-by-construction](../learnings/1786979180337-approver-challenger-calibration-a-release-fatal-as.md)).

The escape-path variant (from the false-safe-averted OUTPUT_REVIEW catch): for any "X is stripped
before it can escape" claim, enumerate the FAILURE/early-return exits AND the PERSISTENCE API surface,
not just the happy path — the question is not "is the happy path safe" but "is there ANY reachable exit
where the guard is skipped AND the value can be persisted/observed." On slang#12729 a same-session
strip proof missed that an errored module carrying a raw `IRPtrLit` is retained in
`mapNameToLoadedModules` and serializable via public `IModule::writeToFile`; a fix that turns a crash
into "continue" must be checked for what downstream states it newly makes reachable (developed further
on the approver-decision-policy page)
([verifying a Devin bug as false requires opening the exact rule](../learnings/1787684744187-approver-challenger-miss-verifying-a-devin-bug-as-.md)).

## Falsify the "clean" prior; audit CI-blindness and companion tests

A bot "no bugs" is a prior conditioned on the bot having read the change correctly — falsify that
condition first. On slang#12599 Devin returned "no bugs" but its own change summary claimed the PR
"dropped the `sha256sum -c` verification step," which the diff flatly contradicts (verification is
retained via the release asset's `digest` field). A reviewer that misreads the CENTRAL mechanism of a
change has its clearance downgraded to "did not review this," not "reviewed and found nothing," and
cannot offset a concrete concern from the other reviewer
([Devin cleared a PR by misreading the central mechanism — verify a bot's summary against the diff](../learnings/1787086964239-approver-challenger-miss-devin-cleared-a-pr-by-mis.md)).

Two structural blind spots the challenger must cover because the harvested reviewers cannot:

- **Diff-scoped reviewers miss companion tests in unchanged files.** slang#12727 changed rendering
  behavior and dropped a "STALLED" tier, leaving its untouched companion suite with 3 now-failing
  tests — invisible to diff-scoped bots, and CI carried zero bits because no workflow runs that suite
  (`py_compile`/import-only checks are green over a suite that never ran). Grep the test suite for the
  removed literal and the changed call pattern; confirm a workflow actually EXECUTES the suite before
  letting "CI green" stand in for "tests pass"
  ([diff-scoped bot reviewers miss companion tests a code-only PR leaves stale](../learnings/1787658226539-approver-challenger-miss-diff-scoped-bot-reviewers.md)).
- **An "include won't resolve" build-break claim must enumerate ALL include dirs the specific target
  compiles with** — including PUBLIC/INTERFACE dirs propagated from linked targets, not just the
  target's own `INCLUDE_DIRECTORIES_PRIVATE`. On slang#12780 Reviewer A's 🔴 build-break was a false
  positive because `slang-unit-test` also pulls `slang-capability-defs`'s INTERFACE includes; the
  authoritative source is `compile_commands.json` for a TU in that exact target, or a full-`-I`
  compiler probe — a single CMake grep undercounts propagated include dirs
  ([Reviewer A missed capability-defs interface-include propagation](../learnings/1787783966666-reviewer-a-missed-capability-defs-interface-includ.md)).

## Two more false-positive shapes, and the aggregate human state

A fallback-reviewer PHANTOM-🔴 recurs on comment/test-only PRs whose body narrates a fix that landed
elsewhere. On slang#12116 Devin flagged "write-up describes compiler changes not present" — while its
own analysis said "no compiler behavior change; comment- and test-only." Verify the premise
mechanically: confirm every `+` code line is a `//` comment, CI is green per-lane, and any "fix is
elsewhere" claim (here the merged #12263); a 🔴 self-contradictory with the reviewer's own summary and
false against the diff is not a verified Bug (not BLOCK) but also cannot be upgraded (not
WOULD_APPROVE) ⇒ CHALLENGER_CONCERN
([Devin phantom-🔴 on comment/test-only PRs whose body narrates a fix that landed elsewhere](../learnings/1787860968707-approver-challenger-miss-devin-phantom-on-comment-.md)).

And a code-diff hygiene finding does not automatically transfer to a metadata/suppression file:
on slang#12571 codex demanded stripping a documenting comment from
`expected-failures.txt`, but that file's own merged convention IS to document per-entry why each test
failed — read the BASE version of the file for precedent before accepting a hygiene must-fix; a new
entry matching the file's merged convention is advisory-at-most with zero decision blast radius
([code-diff comment-hygiene does not govern a metadata/suppression-list file against its own merged convention](../learnings/1786995777303-approver-challenger-miss-code-diff-comment-hygiene.md)).

Finally, on a bot-authored/Devin-only PR, do not read "a human APPROVED at head" from the newest
review row: per-review `state` can be MIXED. On slang#12186 an APPROVE predated a maintainer's
CHANGES_REQUESTED on the same commit; the authoritative aggregate is `gh pr view --json
reviewDecision,mergeStateStatus` (here CHANGES_REQUESTED / BLOCKED). A clean automated review never
overrides a live human changes-request ⇒ CHALLENGER_CONCERN / ABSTAIN
([bot-authored (Devin-only) PR: check reviewDecision/mergeStateStatus, not just the newest review state](../learnings/1787880881103-approver-challenger-miss-bot-authored-devin-only-p.md)).

**Source learnings (14):**

- [Reviewer finding on a mechanically-touched line: check attribution before block-vs-abstain-vs-approve](../learnings/1786694508257-approver-challenger-miss-reviewer-finding-on-a-mec.md) — slangpy#1108; a real Major on a `.get()`-stripped line was pre-existing; INTRODUCED vs byte-identical is the classifier; pre-existing ⇒ OPEN_GAP, not BLOCK.
- [A self-contradicting Devin fallback 🔴 still forces ABSTAIN, not BLOCK or approval — verify by building at head](../learnings/1786983473416-approver-challenger-miss-a-self-contradicting-devi.md) — slang#12503; `import glsl;` never exposes internal members (isDeclVisibleFromScope); disproof justifies ABSTAIN, not upgrade.
- [Code-diff comment-hygiene does not govern a metadata/suppression-list file against its own merged convention](../learnings/1786995777303-approver-challenger-miss-code-diff-comment-hygiene.md) — slang#12571; read the BASE file for precedent; a matching new entry is advisory, not a CHALLENGER_CONCERN.
- [Devin cleared a PR by misreading the central mechanism — verify a bot's summary against the diff before trusting its "no bugs"](../learnings/1787086964239-approver-challenger-miss-devin-cleared-a-pr-by-mis.md) — slang#12599; Devin claimed the PR dropped checksum verification (it was retained); a mismatch downgrades the source to "did not review this."
- [A PR that lifts a subclass override into a shared base changes EVERY inheriting subclass](../learnings/1787580519409-reviewer-heuristic-a-pr-that-lifts-a-subclass-over.md) — slang#12688; enumerate inheritors and check downstream emit compatibility; mechanism source-verifiable, outcome needs CI.
- [Devin flags a removed incidental prelude-reset as a 🔴 leak-forward bug when the sibling tool has the same no-reset by design](../learnings/1787611620922-approver-challenger-miss-devin-flags-a-removed-inc.md) — slang#12593; slang-test never resets the NVAPI prelude by documented design; branch platform-gated; affected tests green.
- [Devin flags a per-op missing brace without tracing the Super:: fall-through](../learnings/1787621185192-approver-challenger-miss-devin-flags-a-per-op-miss.md) — slang#12688; CUDA delegates MakeArrayFromElement to CPPSourceEmitter via `return Super::tryEmitInstExprImpl`; grep the `.h` for `typedef ... Super`.
- [Diff-scoped bot reviewers miss companion tests a code-only PR leaves stale](../learnings/1787658226539-approver-challenger-miss-diff-scoped-bot-reviewers.md) — slang#12727; 3 failing tests in an untouched suite; a `py_compile`/import-only check is green over a suite that never ran.
- [Verify a code-review critique's mechanism empirically before acting on it](../learnings/1787672413185-verify-a-code-review-critique-s-mechanism-empirica.md) — slang#12636; `-dump-ir` showed the proposed guard sat in dead code; over- AND under-reaching is the tell of the wrong fix.
- [Verifying a Devin "bug" as false requires opening the exact rule it cites — not adjacent artifacts](../learnings/1787684744187-approver-challenger-miss-verifying-a-devin-bug-as-.md) — slang#12378; CONTRIBUTING.md:362-368 did require the doc update; enumerate escape/early-return exits + persistence API for "stripped before escape" claims; verify policy before the append-only ledger.
- [Reviewer A missed capability-defs interface-include propagation to slang-unit-test](../learnings/1787783966666-reviewer-a-missed-capability-defs-interface-includ.md) — slang#12780; enumerate ALL include dirs incl. PUBLIC/INTERFACE propagated; `compile_commands.json` for the exact target is ground truth.
- [Devin phantom-🔴 on comment/test-only PRs whose body narrates a fix that landed elsewhere](../learnings/1787860968707-approver-challenger-miss-devin-phantom-on-comment-.md) — slang#12116; confirm every `+` code line is a `//` comment + CI green + the "fix elsewhere" merged; ⇒ CHALLENGER_CONCERN.
- [Bot-authored (Devin-only) PR: check reviewDecision/mergeStateStatus, not just the newest review state](../learnings/1787880881103-approver-challenger-miss-bot-authored-devin-only-p.md) — slang#12186; an APPROVE predated a maintainer CHANGES_REQUESTED; the aggregate was BLOCKED ⇒ ABSTAIN.
- [A RELEASE-fatal assert on a layout-transparent property is OPEN_GAP not BLOCK](../learnings/1786979180337-approver-challenger-calibration-a-release-fatal-as.md) — slang#12539; enumerate PRODUCERS for reachability; SLANG_ASSERT→SLANG_RELEASE_ASSERT trades UB for a defined abort; also expand accordion findings, never clear-or-block on an unread finding.
