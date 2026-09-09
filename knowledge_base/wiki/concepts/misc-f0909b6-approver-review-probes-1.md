---
title: Approver Review Probes — Reachability, Coverage, and Complexity
type: concept
group: misc
tags: [approver, challenger, reachability, coverage-gap, open-gap, unreachability, blast-radius, shared-base]
source_count: 12
---

## TL;DR

Concrete probes the shadow approver's challenger stage uses to decide OPEN_GAP vs clear on Slang
PRs. Recurring failure mode: a cheap, decisive probe answers one half of the question and *feels*
like the whole risk, masking an unasked expensive one. The corrections:

- **A new recursive walk over a type/decl graph is a hypothesis about complexity, not a proof of
  linearity.** Ask: is there a visited-set/memo? Which direction does it short-circuit, and does
  that make the pathological input the COMMON one? A shared-subgraph DAG makes an un-memoized walk
  exponential.
- **An unreachability clear is only as strong as its WEAKEST call path.** Enumerate EVERY entry:
  direct external callers (filtered by what?), self-recursion (does it synthesize a new key that
  defeats your filter?), and any construction site for the "impossible" shape.
- **Trace the PRODUCER before an "unreachable, couldn't-refute" abstain.** A consumer/retry path
  operating on data a prior pass validated is only exploitable if the producer can leave it bad. For
  deserialization: the eager load-time skeleton scan usually pre-validates the same immutable data
  the lazy path later reads. "A throw can't leave partial state" is FALSE; "no throw can newly fire
  here, the checks already passed on immutable data" is the real safety property.
- **A bot verdict improving on CORRECTNESS grounds says nothing about a COVERAGE gap** — orthogonal
  axes. Investigation can only add caution, never upgrade a coverage abstain; identify the exact
  test that would close it and grep for it at the new head.
- **"Untested target X" on a shared-base emit change is not a gap** if X doesn't override the changed
  method AND already has a valid emit case for the op AND a precedent/existing test covers the path.
- **N names collapsing to 1 feature** — open the feature's DETECTION SITE and ask whether that one
  bit implies every capability the N names promise.
- **A doc/tutorial PR has a reader-execution-order failure mode** a fact-check misses (an `export`
  in an early step leaking into a later step's environment).
- **A master-merge into a PR can silently REVERT the PR's deletions** — count removed patterns at
  three refs (master / prior head / new head), because CI can't see un-suppressed tests staying
  green.
- **A `paths:` filter on a linter workflow can drop transitively-reached inputs** (actionlint lints
  a composite `action.yml` when a discovered workflow `uses:` it).
- **"Strip is unconditional" needs three probes**: which pass removes which inst, every early-return
  before the strip, and persistent-output vs in-memory/debug serialization.

## Complexity and reachability of new code paths

A new recursive type-walker with no memo is exponential on copyable fan-out DAGs. On slang#11118,
`typeContainsNonCopyableImpl` short-circuits `return true` only on the first non-copyable field, so
the pathological input is a *purely copyable* deep DAG where a struct's fields reference the same
lower struct twice — 2^k node revisits, bounded only by kMaxTypeNestingDepth=128, reachable during
checking via `getFuncType` on any inout param. The fix keys the memo on the resolved/substituted
`Type*`, not the decl ([a new recursive type-walker with no memo/visited-set is
exponential](../learnings/1787558614076-approver-challenger-miss-a-new-recursive-type-walk.md)).

Unreachability clears fail when they only cover the front door. On slang#12752 an "early-return
changes control flow" gap was cleared by proving the external caller filters keys via
`declRef.as<AssocTypeDecl>()` — but the same function RECURSIVELY re-invokes itself with a
*synthesized* requirement key, and `getThisTypeWitness` constructs the "impossible" pairing
elsewhere, so the front-door filter never touched the internal re-entry. Enumerate every entry;
a construction site for the shape you claimed can't occur flips the burden onto you
([reachability proof must cover recursive/synthesized-key call
paths](../learnings/1787681524479-approver-challenger-miss-reachability-proof-must-c.md)).

On deferred-IR-load code (slang#12446, raised twice), the refutation is PREVALIDATION, not "a throw
can't leave partial state." `_readInstMinSizeInBytes` runs for EVERY inst — including deferred
bodies — in the single load-time walk BEFORE `setDeferredBodyLoader`, so every string-length assert
is evaluated up front against the same immutable flat table; a corrupt length aborts the whole load
before any body is deferred, so the sizing loop's only abort source cannot NEWLY fire on
successfully-loaded unchanged data ⇒ the retry precondition is never established ([trace the
PRODUCER before an unreachable-couldn't-refute
abstain](../learnings/1787732578418-approver-challenger-miss-trace-the-producer-before.md),
[unreachable retry-desync refutes via
PREVALIDATION](../learnings/1787747144797-approver-challenger-miss-unreachable-retry-desync-.md)).
The mechanical countermeasure: for any "consumer reads X unvalidated" abstain, grep every producer
of X and confirm none validates it earlier — an abstain that survives that trace is real. And a
"mirror of existing function X" safety argument does NOT transfer X's contract unless X has the same
fallbacks — verify, don't analogize. Absolutes ("unconditional", "never reaches") are the tell that
a byte-cheap grep would sharpen the claim, as on slang#12729 where "strip is unconditional" hid three
imprecisions: strip removes the *carrier* while a separate DCE removes the literal, an error
early-return skips the strip, and a default-off in-memory debug round-trip (not persistent output)
is the only path that sees the unstripped value ([name the early-return + DCE, split debug
round-trip from persistent
serialization](../learnings/1787658960059-approver-challenger-miss-strip-is-unconditional-na.md)).

## Coverage gaps orthogonal to correctness

A cleaner bot verdict is investigation, not a test. On slang#12574 R3 the production Claude review
jumped 🟡→✅ on correctness grounds and a fresh refactor commit landed — but the abstain was a
*coverage* gap (a load-bearing obfuscation guard untested for the precompiled-lib-without-obfuscate
path), which the refactor never touched. Correctness and coverage are orthogonal; the rule is
identify the exact closing test and grep for it at the head, treat an improved verdict as a
correctness signal only, and when reachability is unverifiable and the blast radius is a hard crash,
inability-to-check ⇒ ABSTAIN ([a bot verdict improving 🟡→✅ on correctness does NOT close a
coverage-gap abstain](../learnings/1787653906904-approver-clause-gap-a-bot-verdict-improving-on-cor.md)).
The load-bearing-guard finding itself (slang#12574 R2) is a template: an author's "removing X is
byte-identical / X is just defensive" comment is scoped to ONE of two cases — redundant on the
tested same-request path, but load-bearing on the untested precompiled-module path where it prevents
a hard-abort — so re-derive reachability + blast radius for the SPECIFIC untested scenario, and
convergent flags from two independent reviewers on an untested guard should raise scrutiny
([#12574 R2 is ABSTAIN — "maintainability 🟡 clears" misfired on a load-bearing
guard](../learnings/1787597864736-approver-critique-mustfix-correction-12574-r2-is-a.md)).

The mirror-image error is over-abstaining on a shared-base change. On slang#12688 a
target-independent predicate moved into `CLikeSourceEmitter`; abstaining because "no test names
GLSL" was wrong — GLSL doesn't override the method (so it gets identical behavior), already has a
valid `MakeArray` emit case, and a precedent test round-trips nested GLSL constructors. Evaluate
"untested target" gaps against the inheritance + existing-emit-case + precedent-test triad, not the
new test's target list ([shared-base emit change untested on target X is not an OPEN_GAP when X
inherits the base + has a valid emit path +
test](../learnings/1787699711006-approver-challenger-miss-shared-base-emit-change-u.md)).

Granularity is its own coverage question. On slang#12735 five `VK_NV_cooperative_matrix2` sub-feature
NAMES all mapped onto one `rhi::Feature::CooperativeMatrix2`, which slang-rhi sets from only
`cooperativeMatrixWorkgroupScope` — so a device with that bit true but a sub-bit false would now RUN
a sub-feature-gated test instead of SKIP, the opposite of intent. For a name→feature mapping, open
the DETECTION SITE (the `VkPhysicalDevice*FeaturesNV` struct) and ask whether the one bit implies
every promised capability; "the name resolves" ≠ "the resolved feature means what the caller needs"
([verify the RESOLVED feature's GRANULARITY, not just that the name
parses](../learnings/1787727751132-approver-challenger-miss-name-to-feature-mapping-p.md)).

## Reader-execution order, and deletions a merge silently reverts

Even a trivial-looking change carries a reachable gap. A docs-only ASan-instructions PR (slang#12736)
did `export ASAN_OPTIONS=detect_leaks=0` in a build block, and a later runtime snippet assumed the
same shell — so leak detection stays disabled through the doc's own `slang-test` step. For a
doc/tutorial PR, trace the *sequence a reader executes*, not just whether the facts are correct
([a doc-only PR can carry a reachable OPEN_GAP when an instruction persists into a later
step](../learnings/1787664395992-approver-challenger-doc-only-pr-can-carry-a-reacha.md)). And on a
re-gate over a merge/rebase head, a union "keep both" merge of an append-only list preserves both
sides' additions but silently discards one side's DELETIONS — on slang#12465 a master-merge restored
4+ test-suppression entries the PR had removed, invisible to green CI because an un-suppressed test
that now passes is reported, not failed. Identify what the PR REMOVES, count its presence at master
/ prior head / new head, and never trust the merge commit's "keeps both blocks" rationale
([a master-merge into a PR can silently REVERT the PR's
deletions](../learnings/1787583726722-approver-challenger-a-master-merge-into-a-pr-can-s.md)).
The same "enumerate the tool's real input set" discipline catches a narrowed `paths:` filter: adding
`{.github/workflows/**, .github/actionlint.yaml}` to `check-actionlint.yml` dropped composite
`action.yml` files, which are TRANSITIVE actionlint inputs (linted when a discovered workflow
`uses:` them) — a verified 🔴 in the PR's own artifact ⇒ BLOCK, not OPEN_GAP
([a paths: filter added to a lint workflow can silently drop coverage its bare-linter had
transitively](../learnings/1787597825103-approver-clause-gap-a-paths-filter-added-to-a-lint.md)).

**Source learnings (12):**
- [a new recursive type-walker with no memo/visited-set is exponential](../learnings/1787558614076-approver-challenger-miss-a-new-recursive-type-walk.md) — memo on resolved Type*, not decl; a copyable fan-out DAG is the pathological input.
- [A master-merge into a PR can silently REVERT the PR's deletions](../learnings/1787583726722-approver-challenger-a-master-merge-into-a-pr-can-s.md) — count removed patterns at three refs; CI can't see un-suppressed tests staying green.
- [A paths: filter can silently drop transitively-reached lint coverage](../learnings/1787597825103-approver-clause-gap-a-paths-filter-added-to-a-lint.md) — actionlint lints composite action.yml via workflow `uses:`; verified 🔴 → BLOCK.
- [#12574 R2 is ABSTAIN — "maintainability 🟡 clears" misfired on a load-bearing guard](../learnings/1787597864736-approver-critique-mustfix-correction-12574-r2-is-a.md) — a guard redundant on the tested path is load-bearing on the untested sibling.
- [A bot verdict improving 🟡→✅ on correctness does NOT close a coverage-gap abstain](../learnings/1787653906904-approver-clause-gap-a-bot-verdict-improving-on-cor.md) — correctness and coverage are orthogonal; grep for the exact closing test.
- ["strip is unconditional" — name the early-return + DCE, split debug round-trip from serialization](../learnings/1787658960059-approver-challenger-miss-strip-is-unconditional-na.md) — three imprecisions in one "obvious" absolute claim.
- [a doc-only PR can carry a reachable OPEN_GAP when an instruction persists into a later step](../learnings/1787664395992-approver-challenger-doc-only-pr-can-carry-a-reacha.md) — trace the reader-execution sequence, not just fact-correctness.
- [Reachability proof must cover recursive/synthesized-key call paths](../learnings/1787681524479-approver-challenger-miss-reachability-proof-must-c.md) — an unreachability clear is only as strong as its weakest entry; a synthesized key defeats a front-door filter.
- ["Shared-base emit change untested on target X" is not a gap when X inherits + has a valid emit path](../learnings/1787699711006-approver-challenger-miss-shared-base-emit-change-u.md) — evaluate against inheritance + existing-emit-case + precedent-test triad.
- [name-to-feature mapping PRs — verify the RESOLVED feature's GRANULARITY](../learnings/1787727751132-approver-challenger-miss-name-to-feature-mapping-p.md) — open the detection site; N names collapsing to 1 feature bit is a coarse gate.
- [Trace the PRODUCER before an "unreachable-couldn't-refute" abstain](../learnings/1787732578418-approver-challenger-miss-trace-the-producer-before.md) — grep every producer of the data a consumer reads unvalidated.
- ["unreachable retry-desync" refutes via PREVALIDATION, not "a throw can't leave partial state"](../learnings/1787747144797-approver-challenger-miss-unreachable-retry-desync-.md) — the safety property is "no throw can newly fire on already-validated immutable data."
