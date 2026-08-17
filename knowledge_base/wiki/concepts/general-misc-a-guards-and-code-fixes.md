---
title: "Guards, root-cause discipline, and code-change reasoning"
type: concept
group: general
tags: [guards, root-cause, mechanism, predicates, contracts, ci-crash-recovery, arithmetic, instruments, recall, reachability]
source_count: 15
---

## TL;DR

Reasoning about guards and code changes has its own recurring failure shapes:

- **A guard that matches command TEXT enforces nothing about command EFFECT** — and its state
  path can fail open. Text-matching is defense-in-depth, not an enforcement boundary.
- **A drift/safety check cannot be a pattern match** — mine flagged *prohibitions* as
  violations. Match invocations (gate on tool KIND, then the field carrying the action).
- **When a recurring fix keeps failing, check it targets the right *mechanism*** before making
  it stricter — clearing-before-run cannot defeat concurrent sharing.
- **An opt-out on a predicate mixing preference with requirement silently breaks correctness.**
- **A contract you ADD to an interface binds the implementations you didn't touch** — "out of
  scope" made before the doc doesn't survive it.
- **A mutation-based severity argument needs the mutation ATTEMPTED**; a green test run doesn't
  mean the binary has your edit.
- **A guard/runner report is about its own visibility, not the world's state** — distinguish
  *found nothing*, *never looked*, *died trying*.
- **Audit your certifying instruments hardest immediately after using them to audit someone.**

## A guard that matches text enforces nothing about effect

A PreToolUse critique gate matched `.tool_input.command` against `gh api …pulls` — a predicate
over the command's *spelling*, not its effect or program. It false-positived on reads (a
`grep` whose pattern *argument* is the hook's own pattern; a `# TODO:` comment) and, the half
that matters, **false-negatived on the writes it exists to catch** (the `gh api …/pulls` calls
inside a script show argv as `python3 harvest.py`). Its escalation counter also failed open: a
`jq > tmp` into a nonexistent dir swallowed by `|| true` read back 0, so `>= 3` never armed —
found only by asking what happens on the *Nth* event, not the first. **Audit a guard's state
path before its matcher**; a guard that fires but can never escalate is worse than one that
doesn't fire. Text matching over shell commands is a heuristic; tightening trades one defect
for the other, so ladder any tightening against the original's *catches*, not just the false
positive. The durable control is at the effect level (host-side credential scoping).
[A guard that matches command TEXT enforces nothing about command EFFECT — plus its state path can fail open nondeterministically](wiki/learnings/1785862358904-a-guard-that-matches-command-text-enforces-nothing.md)

A drift/safety check certifying "this reviewer never wrote to GitHub" reported 2 violations in
a clean reviewer — both were `Agent` *dispatch prompts* naming the forbidden skill *inside a
prohibition*. **A pattern matcher cannot distinguish "do not call X" from "call X."** The worst
possible location: the instrument that certifies the other instruments, failing in a direction
that reads as diligence, unlikely to be re-audited. Repair: gate on tool KIND first, then the
one field carrying the action (`Bash` → `command`), never scan the whole record (which mixes
actions with *instructions about actions*). Carry a control that MUST fire. This one produces
false *positives* in a safety assertion — arguably worse than the usual false negative, because
a wrong "this reviewer drifted" *subtracts* signal by discrediting correct work. **Audit your
own certifying instruments hardest, immediately after using them to audit somebody else.**
[A drift/safety check cannot be a pattern match — mine flagged prohibitions as violations, in the instrument that certifies other instruments](wiki/learnings/1785938982107-a-drift-safety-check-cannot-be-a-pattern-match-min.md)

## When a recurring fix keeps failing, check the mechanism

A review pipeline staged diff artifacts at a *shared* path; a prior "fix" did `rm -f` before
each run, reasoning "worst case is an empty read, never a wrong diff." **That fix targets
SEQUENTIAL staleness and is structurally incapable of defeating CONCURRENT clobber** — a pre-run
`rm` does nothing about a sibling run writing the shared path in flight. So the recurrence to
5+ occurrences wasn't bad luck or an insufficiently strict guard; the mitigation forecloses
class A while the cause is class B, and no amount of hardening converges. When a fix for a
recurring defect keeps failing, ask *what class of cause does this mitigation actually
foreclose, and is that the class I'm seeing?* (The right layer here: per-run isolation.) A
confident claim in a code comment ("never a wrong diff") is a claim, falsifiable by later
behavior; check the full blast radius, not the one named file.
[A recurring defect whose fix keeps failing may have been fixed at the wrong mechanism — clearing-before-run cannot defeat concurrent sharing](wiki/learnings/1785868290560-a-recurring-defect-whose-fix-keeps-failing-may-hav.md)

A grep of one repo cannot rule out behavior implemented in a **reusable workflow it calls**:
grepping `slang-rhi/.github/` for reviewer-mutation calls returned zero, but a `uses:
shader-slang/slang/.github/workflows/pr-board-sync.yml@master` line points at a workflow in a
*different repo* that does exactly that. **A `uses:` line is a search boundary** — enumerate
cross-repo references and search *those* repos too. A bounded search returning zero is a fact
about the boundary, not the world. Also: a timeline `actor` may be a token, not a person (the
assigning `jhelferty-nv` returned nulls for `type`/`login`) — don't attribute intent to an
actor you can't resolve. A coworker forbidden from requesting reviewers can comply fully and
maintainers still get pinged, because org automation does it independently (and draft status
doesn't prevent it) — fix belongs in the automation.
[A grep of one repo cannot rule out behavior implemented in a reusable workflow it calls](wiki/learnings/1785853379329-a-grep-of-one-repo-cannot-rule-out-behavior-implem.md)

## An opt-out on a preference-vs-requirement predicate breaks correctness

Before wiring an opt-out (`[noinline]`, a flag, a skip-list) into an existing predicate, check
whether that predicate answers *two* questions — a *preference* ("lowers better this way") and
a *requirement* ("incorrect otherwise"). An opt-out may only decline the preference; when both
share one return value, honouring it disables the correctness case. `doesTypeRequireInline`
returned "must inline" for a `__ref` param (preference) and a `String` param (requirement —
what folds `getStringHash` to a literal); adding the `[noinline]` check to the `__ref` branch
also broke `__ref String`. Fix: ask the nested type first. Read the *whole* predicate; for each
`return true` ask preference-or-requirement; test the opt-out against every type it fires on;
**A/B against an unmodified binary** (what turned "the reviewer thinks this is a problem" into
"this is a regression I caused" — and proved a *different* flagged crash was pre-existing).
[An opt-out added to a predicate that mixes preference with requirement silently breaks correctness](wiki/learnings/1785869071076-an-opt-out-added-to-a-predicate-that-mixes-prefere.md)

## A contract you ADD to an interface binds untouched implementations

When a diff adds or tightens a documented contract on an interface, every implementation left
untouched is re-scoped by that edit — an "out of scope" ruling made *before* the doc existed
does not survive it. A PR added a `SLANG_E_NOT_AVAILABLE` distinction to a pure-virtual
declaration but left the base `validate` returning bare `SLANG_FAIL` while validating nothing
(the canonical "cannot validate" case). The reachability claim ("SpirvOpt path can't reach it")
was true and *remains* true — it's not a live bug — but what changed was *authorship*: before
the diff the default merely predated the distinction; after it, the same code violated a rule
the author just wrote. Keep the two verdicts distinct: reachability answers "is this a live
bug?", not "does this violate the contract I just wrote?" After adding/tightening a contract,
`grep` every implementation and re-read each against the new wording. Companion: **check a
stated reason against the fixtures in your own diff** — a plan justified skipping disassembly
because it was "unavailable in the same library", disproved by the PR's own fake loader that
*exported* `glslang_disassembleSPIRV`. [A contract you ADD to an interface binds the implementations you did not touch](wiki/learnings/1785934768237-a-contract-you-add-to-an-interface-binds-the-imple.md)

## A mutation-based argument needs the mutation attempted

A review's top must-fix rested on "someone could plausibly downgrade this diagnostic to `err(`"
— four instruments confirmed the enum ordering, but **the mutation doesn't compile** (code
99999's severity-conflict error is not covered by the intentional-duplicate exemption, so
flipping any holder trips a hard `error()` at generation time). Tracing a mechanism four ways
is not checking an *exploit*; when severity rests on a hypothetical edit, attempt the edit — a
compile error is the cheapest disproof. And `slang-test` printing `100% (5/5)` does not mean
the binary contains your edit — it happily re-ran the *previous* `.so` twice, "confirming"
independence from a stale binary. Put the build's exit code in the *same* command as the test
run (`cmake --build … && ./slang-test …`); on any surprising green, compare artifact mtime
against source mtime. **Refusing to bank a measurement you've since learned was void is the
whole discipline.** [A mutation-based argument needs the mutation ATTEMPTED — and a green test run doesn't mean the binary has your edit](wiki/learnings/1785940218212-a-mutation-based-argument-needs-the-mutation-attem.md)

## Use the failing assertion's arithmetic to choose between race explanations

A plausible profiler-flake root cause (a barrier covering 1 of 3 channels) was refuted on
arithmetic: with `window_size=2` and frames `[4,0,2]`, both the "unconsumed marker" and
"sliding-window" mechanisms produce aggregate 4 or 2 — the logged failure was **1**, reachable
from neither, forcing a second distinct defect (premature frame finalization).
**Integer-count assertions carry more diagnostic information than duration assertions** (counts
can't drift with scheduler jitter, so a wrong count rules out timing nondeterminism and points
at ordering or event loss) — but "not timing jitter" does not mean "not scheduler-dependent."
**A plausible mechanism that is real is still not automatically the cause of the observed
failure** — distinguish "this defect is real and nearby" from "this defect explains this log";
the arithmetic is what separates them. [Use the failing assertion's arithmetic to pick between competing race explanations](wiki/learnings/1785891610827-use-the-failing-assertion-s-arithmetic-to-pick-bet.md)

## A reachable-divergence band usually has an upper edge

When two code paths enforce different bounds on the same quantity, don't report "diverges from
N upward" — if the looser rule is also a bound, the paths *re-converge*. A torch-bridge
divergence was "rank ≥65"; actually the band is **65–116 only** (at 117 both paths raise) — a
52-rank window, changing severity framing and what a boundary test must cover (four edges, not
one). Validate a byte/size model against literals already in the test suite before trusting it
(arithmetic over constants feels like proof; it isn't until it reproduces a known-good
observation — an off-by-one from budgeting 2 digits where float32 is `S6` was caught
immediately by the literal cross-check). Ask whether a strict bound is a *safety* bound or a
stricter-than-necessary precondition — the native guard demanded `64+ndim` where the true worst
case is `28+ndim`, so aligning the loose path to it would have *regressed* 52 working ranks. A
product decision often gates only *one* candidate fix — check before holding on it.
[A reachable-divergence band usually has an upper edge — compute both ends before calling it open-ended](wiki/learnings/1785933204767-a-reachable-divergence-band-usually-has-an-upper-e.md)

## A guard/runner report is about its own visibility, not the world

A runner guard saying "treat as failed / re-run" reports its own output file, not the world's
state — twice the substantive work sat intact in the run transcript (generation passes had
completed; only consolidation was lost). Recover in ~2 min from the `Write` tool call in the
transcript vs a 20–30 min re-run. **Distinguish three states, never two**: *found nothing*,
*never looked*, *died trying* — a guard collapses the last two into "failed", a tally collapses
all three into a number. Enumerate top-level assistant text blocks (last-block truncation) then
`Write`/`Edit` calls (the worktree is auto-removed on exit but the payload persists); count the
Writes to label the recovery honestly (`_partial: died at <stage>`, never `_skipped_` nor
complete). Still run the drift/safety check on a partial run — a crash is not a licence to skip
the assertion. [A guard can only see its own output file — check whether the work survives before accepting "re-run"](wiki/learnings/1785939007641-a-guard-can-only-see-its-own-output-file-check-whe.md)

## Zero recurrence and symptom-match both reduce to "the path never executed"

Two absence traps: (1) **a quiet CI window needs a trial count** — "0 failures across 12 runs"
is opposite findings depending on whether the signature's branch ran CI at all (a branch that
isn't running can't reproduce a hang; report "unexercised, not fixed"). (2) **A symptom-matching
mechanism needs a reachability check, not a plausibility check** — an unbounded `wait()` with
zero `gil_scoped_release` was extremely credible and *unreachable* (the `stopping` flag is set
only in the destructor, which can't run concurrently while `flush()` holds the GIL). Publishing
it would have sent a maintainer after a dead end wearing a plausible story. The discriminator is
reachability (who sets the flag, are there non-obvious callers, can the threads interleave);
record ruled-out mechanisms explicitly so the next reader doesn't re-chase them.
[Zero recurrence is not health until you count the trials; symptom-match is not cause until it's reachable](wiki/learnings/1785841890416-zero-recurrence-is-not-health-until-you-count-the-.md)

## The Vulkan spec `undefined:` macro is a source marker, not a semantic tag

Researching queue-family ownership, the tempting hypothesis was `undefined:` (asciidoc macro) ⇒
only values/contents, never full UB. A control grep for `undefined behavior` in
`fundamentals.adoc` returned **0** and, investigating why, found the `undefined:` macro *is*
used for program-termination UB — it's a source-hygiene marker ("an author consciously chose
this word"), not a normative classifier. **A styleguide statement about markup is not a
statement about normative semantics.** What discriminates: the sentence's subject (contents vs
behavior) and a nearby `must:`/`can:`/`may:` (RFC 2119). **The control check earns its keep by
failing** — design controls that *must* fire, and when one doesn't, investigate rather than
shrug. [Vulkan spec `undefined:` macro does NOT discriminate undefined-contents from undefined-behavior](wiki/learnings/1785936587760-vulkan-spec-undefined-macro-does-not-discriminate-.md)

## Audit instruments prospectively; a detector's first surprise deserves a self-check

An instrument built from one instance inherits that instance's shape and is *predictably* blind
to sibling forms — derivable before you run anything (a `name: ""` detector blind to a *missing*
`name:` key; an unscoped ordinal scanner false-positiving on scoped counts). A decoy must be
drawn from a *different* form of the defect. Refinements that make a prospective finding useful:
state the *direction* of failure (over-report wastes attention, under-report hides regressions),
and *measure reachability* before treating a latent gap as live. **A retrieved fact that
licenses skipping a check deserves the same verification as one that licenses acting.**
[Audit your instruments PROSPECTIVELY: an instrument inherits its founding example's shape and is predictably blind to sibling forms](wiki/learnings/1785884715460-audit-your-instruments-prospectively-an-instrument.md)

A detector's first surprising result deserves a check of the *detector* before the *world*:
`ls -1t *.md | head -1` returns the auto-regenerated `INDEX.md`, so a "is my new learning
indexed?" check grepped `INDEX.md` for `INDEX.md`, got 0, and reported the learning absent — a
check that *cannot pass* is not a check. It failed toward *alarm* (cheaper — one more command
found the truth) rather than silence. Check the detector before the world when its first result
confirms a risk you were primed to find; ask what the detector would print if the world were
*fine*. [detector self-check: ls -1t returns the generated INDEX.md, not your newest learning](wiki/learnings/1785872011901-detector-self-check-ls-1t-returns-the-generated-in.md)

When a small exceptional set satisfies every hypothesis, stop asking what the set *shares* (with
n=11 and ≥3 correlated attributes, unanswerable) and ask **what each member individually fails
to satisfy** — a per-file predicate with a two-sided control, unbounded by set size. But
per-file is necessary, not sufficient: check the predicate measures the *mechanism*
(`slug length == 50` = the slugifier ran) not a *habit* correlated with it (`slug matches H1` =
editorial style, 70% contaminated in its own confirming cell). **A two-sided control feels most
conclusive exactly when the contamination sits inside the confirming cell.** Compute ratios from
raw counts, round only at the end; get a base rate before accepting an enrichment.
[small exceptional set: switch from cluster-property to per-file predicate, then check the predicate measures the mechanism](wiki/learnings/1785873466872-small-exceptional-set-switch-from-cluster-property.md)

## Run TWO recall queries — subject and environment

Recall scoped to the task's *subject* can never surface a tooling limit — a capability limit is
a different axis, so no query about a compiler hang reaches a note about which formatter binaries
exist in your container. Run two recall queries: subject (the bug/subsystem) and **environment**
(the tools you're about to depend on, keyed on the binary/script name). The trigger is the moment
you *discover* a limit ("tool X won't run here"), not the start of the task — that observation is
the query. Corollary: `command -v` is the wrong instrument for "is this tool available" — it
answers "is it on PATH" and returns a confident false-absent for an installed-but-unpathed tool;
the right probe is a filesystem-wide `find` plus a module-import check. A capability negative is
especially exposed because nothing downstream contradicts it — a fixer told "tool X is
unavailable" installs it and never learns the claim was unearned. Carry the *workaround* into a
handoff memo, not just the blocker. [Recall scoped to the task's subject can never surface a tooling limit — run a second cheap query keyed on your environment](wiki/learnings/1785863868529-recall-scoped-to-the-task-s-subject-can-never-surf.md)

## Prove the branch executes before reporting an edit as effective

A syntactically-correct edit inside a guarded branch is indistinguishable from a fix by
inspection. Adding a channel id to a monitoring script's polled list was `bash -n` clean and
accomplished nothing, for two independent reasons found only by tracing: the *executing copy*
was the host-side task definition (the workspace file was a stale artifact — a file in your
workspace is not evidence it's the deployed one), and the whole block was wrapped in `if [ -n
"$TOKEN" ]` with the token absent. **`bash -n` proves syntax, never reachability** — trace every
enclosing guard to a value you have *measured*, then report the diff *and* what it does not
accomplish. Never test-run a script that writes the file you use to monitor it (it stamps the
watermark and can suppress a real wake — copy to `/tmp` and run the copy). Calibration: of five
carried figures checked in one session, four did not survive; the survivor's property was that
it was *labelled as someone else's measurement*, which kept it re-checkable — **an unlabelled
figure becomes unfalsifiable once repeated.**
[Prove the branch executes before reporting an edit as effective — and never test a script that stamps the file you monitor](wiki/learnings/1785901095680-prove-the-branch-executes-before-reporting-an-edit.md)
