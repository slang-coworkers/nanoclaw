---
title: "Slang/SlangPy approver heuristics: CI-signal traps, challenger probes, and verdict classification"
type: concept
group: slang-tooling
tags: [approver, pr-review, challenger, ci-signal, open-gap, abstain, coderabbit, devin, verdict]
source_count: 10
---

## TL;DR

These atoms are field notes from the PR-approver role — what actually carries or reverses a
`WOULD_APPROVE | ABSTAIN_POLICY | BLOCK` verdict. The through-line: **a green combined status
is not head-current CI evidence, and "the code I flagged is gone / addressed" is about intent,
not outcome.** Re-read the real check-runs on the settled head, every revision.

- **The clause `ci_green_on_sha=pass` can be vacuous.** Under `require_ci_green:false` the
  clause short-circuits to pass without reading CI at all; when it does read, the combined
  `/status` endpoint folds only legacy commit-statuses and is **blind to GitHub Actions
  check-runs**. Enumerate check-runs directly with `gh api .../check-runs --paginate`.
- **A PR that changes what a CI check runs can redden that very check** — a formatter-dispatch
  fix that activates a previously-skipped stage over a tree that isn't clean under it.
- **A revision that deletes the flagged code is not a fix** — the break can move (one Windows
  build error swapped for another). Re-run the full procedure and re-read the build check-runs
  from scratch on the new head.
- **A CLI-text change's blast radius includes untouched sibling tools that parse the output** —
  a whole-string-anchored consumer (`[[ =~ ^…$ ]]`, `grep -x`, `re.fullmatch`) breaks on an
  appended line; sweep `extras/**`, `tools/**`, `docs/**`, not just `.github/workflows/**`.
- **A trusted-maintainer build-config-only change abstained on protected-paths and merged
  unchanged is working as designed** — not a false-safe, not a signal to widen the clause.
- **A fallback-tier (Devin-only) 🔴 you're unsure of routes to ABSTAIN, never rounds to BLOCK
  or APPROVE.** A target-neutral core-module change only one backend lowers is OPEN_GAP.
- **Green slangpy PR CI does not exercise the root `setup.py`** (CMake build only); CodeRabbit
  re-reviews in-place (read `coveredCommitId`); don't decide against a moving head.
- **A "not slangc, runtime/driver" verdict can be reached without a GPU** by validating SPIR-V
  and reading the emission path — but state repro-blockers as observed, not as preconditions.

## The CI-signal traps: green is not what it looks like

The most consequential and repeated finding is that the *green* signals an approver naturally
reaches for are frequently blind. The clause script's `ci_green_on_sha=pass` is not evidence
of CI health: under policy `v0-shadow-wide` (`require_ci_green:false`) `eval-clauses.py:184`
short-circuits to pass with "policy does not require CI green" and never reads status at all;
even when the policy *does* require green, `:187` reads the combined `/status` endpoint, which
folds only legacy commit-statuses and is blind to GitHub Actions check-runs — the known
false-green trap
[clause pass is on the policy flag, not CI](../learnings/1787085931116-approver-challenger-miss-a-formatting-dispatch-fix.md).
The remedy, stated across several atoms, is to enumerate the check-runs on the *pinned head*
directly (`gh api repos/O/N/commits/<sha>/check-runs --paginate`) and read the run whose
behavior the PR changes — with **page discipline**: a page-1-only fetch missed both red checks
on PR #12600; the full `--paginate` sweep found `check-formatting` and `check-pr-label`
failing.

That PR #12600 is itself the canonical case of a subtler trap: **a PR that changes what a CI
check runs can redden that very check.** It is a one-line fix to `extras/formatting.sh:444`
(`((run_markdown))` → `((run_all || run_markdown))`) so the markdown stage runs in default
runs — but the `check-formatting` job runs `formatting.sh --check-only` (a `run_all` run), and
*after* this PR that run reaches the markdown stage and prettier flags `REVIEW.md` and residual
`CLAUDE.md`/`README.md` drift the tree was never clean under. The positive control for a
"make the tool run" fix is therefore *does the tool now run clean?* — the decision was
ABSTAIN_POLICY/OPEN_GAP (the `:444` change is correct and minimal, but it leaves a required
check red, so a human decides whether to require the reformat first)
[a dispatch fix reddens its own check](../learnings/1787085931116-approver-challenger-miss-a-formatting-dispatch-fix.md).
(This is the review-side view of the same `formatting.sh` markdown-gating fact synthesized in
the markdown/generated-docs page.)

Green also *undershoots* on slangpy: **green slangpy PR CI does not exercise the root
`setup.py`.** `tools/ci.py` builds via `setup.sh` + CMake and runs pytest against the build
tree; it never `pip install .` / `python -m build` the root package, so a change to top-level
`setup.py` version logic is validated by nothing in the matrix even when all check-runs are
green. Say "PR CI never executes the changed *root* setup.py", not the overbroad "CI never
runs setup.py" (the `install-slangpy-torch` job builds a different `setup.py`). The same atom
adds two head-currency mechanics: **CodeRabbit re-reviews by updating its summary comment in
place**, not always submitting a new review object, so `harvest-reviews.py` keeps returning
exit 10 (stale) while CodeRabbit has re-reviewed the new head — read the head-current signal
from the summary comment's `final_review_risk_coverage:{"coveredCommitId":"<head>"}` + the
`Merge Risk:` line; and a rapid `synchronize` storm means you must run a **settle-watch**
(poll `headRefOid` until unchanged ~2 min) and key the ledger row to the settled head, since
the webhook payload carries no SHA
[slangpy root setup.py + CodeRabbit in-place + settle-watch](../learnings/1788518272934-approver-infra-slangpy-pr-ci-never-runs-root-setup.md).

## Challenger probes: intent is not outcome; enumerate the blast radius

On a revision chain the strong prior is "they addressed my last finding, so it's better now" —
but **that prior is about intent, not outcome.** On slangpy#1120, R2 deleted the entire failing
vcpkg overlay and switched to the built-in crashpad port — a coherent diff aimed exactly at the
finding — yet CI went red again with a *different* root cause (the built-in port failed to
compile under MSVC). Deleting the code that threw error A does not validate A's absence; it
changes the code path, and the replacement has its own untested behavior — a larger, more
surgical diff actually *raises* risk. The catch is to re-run the full procedure and re-read the
build check-runs from scratch on the new commit, waiting for the specific job that failed last
time to reach terminal state, and re-confirm attribution against base `main` each revision. The
verdict class is unchanged (`ABSTAIN_POLICY:CHALLENGER_CONCERN`), one fresh ledger row per
revision, with the challenger field naming the *new* root cause
[a revision that targets the right area is not a fix](../learnings/1787215305719-approver-challenger-a-revision-that-targets-the-ri.md).

The blast-radius lesson recurs for CLI-text changes: **a change to the text of a `-v` /
`-version` / `-help` / banner line can break untouched sibling tools that parse it.** On slang
PR #12647 a `WOULD_APPROVE` reversed to `ABSTAIN_POLICY/OPEN_GAP` after codex named a consumer
the challenger had missed — `extras/repro-remix.sh` captures the full `slangc -version` output
and sanity-checks it with a whole-string-anchored bash regex (`[[ "$SLANG_VERSION" =~
^[0-9]{10,}$ ]]`), which the PR's appended `build-config:` line defeats (the whole string is no
longer all-digits → the guard never fires → a mis-built tag-less compiler passes). A
whole-string matcher (`grep -x`, `re.fullmatch`, `[[ =~ ^…$ ]]`) is defeated by an appended
line even when the semantically-relevant first line is unchanged; only `.splitlines()[0]` /
`head -1` / first-line-anchored patterns are safe. The consumer sweep must cover at minimum
`.github/workflows/**`, `extras/**` (esp. `*.sh`), `tools/**`, and `docs/**` — a clearance is
only as strong as the file set the grep covered, so name the directories you searched and the
ones you didn't
[a slangc -v consumer sweep must include extras/*.sh + tools/**](../learnings/1787326208387-approver-challenger-miss-a-slangc-v-consumer-grep-.md).

## Confirmed-safe shapes and correct verdict classification

Several atoms record the *class* of change that safely clears, so recall sharpens for the next
one. **A trusted-maintainer build-config-only change (root `CMakeLists.txt` / `cmake/**` / a
`.yml`) that is small, green on the full matrix, and a clean read will typically be abstained
on the protected-paths clause AND merged unchanged by the maintainer** — this is the *expected*
behavior of shadow-mode (the clause exists to route build-system changes to a human), and "the
human merged it as-is" confirms the change was safe, not that the abstain was wrong. It would
be worth probing only if the merged head differs from the decision commit (maintainer pushed
fixups); an unchanged head_sha means nothing to mine
[trivial CMake fix abstained then merged](../learnings/1786969458759-approver-human-disagreement-confirmed-safe-trivial.md).

**A CI/composite-action change that swaps a selector predicate** clears when you enumerate both
divergence directions, not just the one the PR advertises. slang#12816 changed the
msvc-dev-cmd `arch:` input from `inputs.platform == 'aarch64'` (target) to `runner.arch ==
'ARM64'` (host); a boolean swap only changes behavior where old and new predicates diverge, so
the decisive probe is the *mirror* case (ARM64-host/non-aarch64-target) — the only place it
could regress — checked against the real `ci.yml`/`release.yml` matrix rows (instantiated
nowhere there, so the fix's only live effect was the intended one). The corroborating datapoint
is green CI on the *unchanged* path, not the fixed path; for any selector swap, write the truth
table of {old, new} over the real matrix rows and name which row exercises the regression
direction, or prove none does
[host-vs-target arch selection](../learnings/1787943412709-approver-confirmed-safe-host-vs-target-arch-select.md).

**An interim target-capability `static_assert` guard** (slang#12643, a `case cuda:`
`static_assert(!__isHalf<T>(), ...)` mirroring a merged sibling) is safe when the predicate
folds *per-specialization* (`__isHalf<T>()` is an intrinsic op, not a `switch(T.kind)` constant,
so it doesn't fire for a symbolic `T` — the #12185 trap of a bare `static_assert(false)`) and
when the `DIAGNOSTIC_TEST` directive is spelled correctly (a mis-spelled directive is silently
skipped, so a diagnostic test can look present but never run). Crucially, matching the
merged-sibling *mechanism* does not vet the *type-set wording*: #12303's "specialized only for
float/uint/int" is true for `Load` but false for `SampleLevel` (whose CUDA trait also accepts
char/short/int, not just float/uint/int) — verified against the actual CUDA headers, an advisory
nit that does not get a free pass because a sibling used the same phrasing
[interim target-capability guard — verify predicate precision](../learnings/1787347373013-approver-confirmed-safe-interim-target-capability-.md).
The **new-attribute-target widening** case (slang#12689, adds `UserDefinedAttributeTargets::EnumCase`)
earns a positive control per claimed mechanism: is the widening pure (pre-PR the position always
errored, so the new collector only rescues previously-erroring input, and it is bracket-only —
never calling `ParseModifiers`, which would eat a bareword modifier-keyword enum-case name); is
the negative test non-vacuous (the wrong-target class must genuinely not be a subclass —
`EnumCaseDecl : public Decl`, not `VarDecl`); is the new flag live (trace set→match→consume);
is a bumped bitmask inert (confirm no reader); and does a per-mechanism test cover parse *and*
reflect *and* serialize round-trip (the mechanisms most likely to silently drop AST-modifier
data)
[new attribute-target: positive-control-per-mechanism](../learnings/1787616477191-approver-challenger-confirmed-new-attribute-target.md).

Two verdict-*classification* atoms close the set. **A fallback-tier (Devin-only) 🔴 does not
automatically round to BLOCK.** slang#12681 added a target-neutral `__IDynamicResourceCastable`
conformance on `__SubpassImpl` that type-checks on every descriptor-heap target while only the
SPIR-V emitter learned to lower it — an *open design gap* (real cross-backend reach) but not a
*verified* miscompile on a supported path, so the correct verdict is ABSTAIN/OPEN_GAP, not
BLOCK. When a 🔴 targets a core-module conformance/conversion (not emit logic), ask: demonstrated
crash/wrong-codegen on a supported path (→ BLOCK), or "enables something whose lowering on other
backends is undecided" (→ ABSTAIN); a `.meta.slang` extension with no target gate has
target-neutral reach by construction, so grep the other emitters to see who lowers it — and a
fallback-tier verdict you're unsure of routes to ABSTAIN, never rounds to BLOCK *or* APPROVE
(reinforced here by an author-flagged "[DRAFT — design unconfirmed]" and a human shepherd
already reviewing)
[Devin 🔴 on a target-neutral conversion is OPEN_GAP, not BLOCK](../learnings/1787792898173-approver-challenger-miss-devin-on-a-target-neutral.md).
And a **"runtime/driver, not slangc" verdict can be reached before a GPU repro**:
slang#12784 (a Vulkan combined-sampler `DescriptorHandle` crash) closed as a graphics-driver
bug, and the slangc verdict held from first triage — reached without a GPU by (1) compiling both
the crashing and workaround shader forms with `slangc -target spirv-asm` and confirming both
pass `SLANG_RUN_SPIRV_VALIDATION=1` (rules out a *structural* SPIR-V defect — state it as
"leading hypothesis" for runtime, not "established"), and (2) reading the emission path to show
the compiler passes the app-supplied index verbatim (`emitDescriptorHeapLoad` → straight into
`OpUntypedAccessChainKHR`, no base-offset arithmetic). Two process lessons: model from the
*actual* repro repo, not the triage paraphrase; and state repro-blockers as what you observed
("reproduced on an RTX 3090"), not as hard preconditions the reporter can refute — and a chain
"close" ends a beat but never licenses leaving a false fact live in a shared artifact
[runtime/driver verdict before GPU repro](../learnings/1788536959957-a-runtime-driver-not-slangc-descriptor-heap-verdic.md).

**Source learnings (10):**
- [Confirmed-safe: trivial maintainer CMake fix abstained on protected-path, merged unchanged](../learnings/1786969458759-approver-human-disagreement-confirmed-safe-trivial.md) — slangpy#1111 ABSTAIN_POLICY then merged unchanged = working as designed, not a false-safe; probe only if the merged head differs from the decision commit.
- [A formatting/dispatch fix can redden the very CI check that runs the tool — verify the activated check](../learnings/1787085931116-approver-challenger-miss-a-formatting-dispatch-fix.md) — PR #12600: `ci_green_on_sha` is vacuous under `require_ci_green:false`; combined `/status` is blind to check-runs; the dispatch fix activates a stage over an unclean tree → ABSTAIN/OPEN_GAP; `--paginate`.
- [A revision that targets the right area is not a fix — re-read CI, the break can move](../learnings/1787215305719-approver-challenger-a-revision-that-targets-the-ri.md) — slangpy#1120: deleting the flagged overlay swapped one MSVC break for another; re-run full procedure + re-read build check-runs per revision; one ledger row per commit.
- [a slangc -v consumer grep must enumerate extras/*.sh + tools/**, not just workflows](../learnings/1787326208387-approver-challenger-miss-a-slangc-v-consumer-grep-.md) — PR #12647: `repro-remix.sh`'s whole-string `[[ =~ ^…$ ]]` guard is defeated by an appended `build-config:` line; whole-string matchers vs first-line; name the file set you searched.
- [Interim target-capability static_assert guard: verify predicate precision, not just the merged-sibling pattern](../learnings/1787347373013-approver-confirmed-safe-interim-target-capability-.md) — slang#12643: per-specialization fold avoids the #12185 symbolic-T trap; DIAGNOSTIC_TEST must be spelled right; the sibling's type-set wording ("float/uint/int") is imprecise for SampleLevel.
- [New attribute-target widening: positive-control-per-mechanism + non-vacuous negative test](../learnings/1787616477191-approver-challenger-confirmed-new-attribute-target.md) — slang#12689: is the widening pure (bracket-only, no ParseModifiers); non-vacuous negative (`EnumCaseDecl : Decl` ≠ VarDecl); live flag; inert bitmask; a test per parse/reflect/serialize mechanism.
- [Devin 🔴 on a target-neutral core-module conversion is an OPEN_GAP abstain, not a BLOCK](../learnings/1787792898173-approver-challenger-miss-devin-on-a-target-neutral.md) — slang#12681: target-neutral conformance only SPIR-V lowers = open design gap, not verified miscompile; grep emitters for who lowers; fallback-tier uncertainty → ABSTAIN, never round to BLOCK/APPROVE.
- [Host-vs-target arch-selection CI fixes: the decisive probe is the mirror-divergence case](../learnings/1787943412709-approver-confirmed-safe-host-vs-target-arch-select.md) — slang#12816: enumerate both divergence directions; the mirror (ARM64-host) is the only regression risk, instantiated nowhere in the matrix; green on the *unchanged* path is the proof.
- [slangpy PR CI never runs root setup.py; CodeRabbit re-reviews in-place; settle-watch head storms](../learnings/1788518272934-approver-infra-slangpy-pr-ci-never-runs-root-setup.md) — #1141: CMake build only, so root `setup.py` version logic is unvalidated; read CodeRabbit's in-place `coveredCommitId`; poll `headRefOid` until settled before deciding.
- [A "runtime/driver, not slangc" descriptor-heap verdict can be reached BEFORE the GPU repro](../learnings/1788536959957-a-runtime-driver-not-slangc-descriptor-heap-verdic.md) — slang#12784: SPIR-V validation + verbatim-index emission path rule out structural/codegen defect (leading hypothesis, not established); model from the real repro; state repro-blockers as observed; push corrections even after a close.
