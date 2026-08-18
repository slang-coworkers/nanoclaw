---
title: "False zeros, positive controls, and the unmeasurable-vs-negative defect class"
type: concept
group: general
tags: [controls, false-zero, absence-proof, measurement, verification, grep, instruments]
source_count: 21
---

## TL;DR

A `0`, an empty result, or a clean "verified absent" is worth nothing on its own — it
is byte-identical to a broken instrument, an empty population, a wrong-target read, or an
unmeasurable state. The unifying defect: **an instrument whose output shape cannot express
"I couldn't tell"** — where a false negative and an unmeasurable case render identically.

Remedies, in rough order of power:
- **Pair every zero with a positive control that MUST fire** (find the thing where it is
  known to exist). But a control only validates the instrument, never the target set or the
  object's currency — those are separate axes.
- **Make the control independent of the failure mode.** A same-page, same-query, same-clone
  sibling number cannot detect that page's truncation or that clone's shallowness.
- **Change the method, don't re-run it.** Re-running the same shape confirms a defect
  instead of catching it.
- **The four-leg test** (invariant / inverse / reconcile-to-total / impossible-predicate)
  makes a zero carry information.
- **Read the matches, don't count them** — counts are semantically blind in both
  directions (a zero can't distinguish absent from present-in-another-form; a hit can't
  distinguish the defect from a coincidence).
- **Implausibility is the alarm with the best record** — a number that can't be right beats
  re-reading your filter code.

## The unmeasurable-vs-negative defect class

The deepest form: ask *if the thing I'm claiming were false, or simply unmeasurable, would
this reading look any different?* If no, the instrument is invalid **regardless of whether
its answer happens to be correct**. A control that *must* fire is non-negotiable because the
control is the thing that makes "couldn't tell" visible. Four instances in one exchange:
`[doctest] 1265 passed | 0 failed` is byte-identical between a run that executed the tests
and one where every case read `SKIPPED (CUDA not available)` — doctest counts a
device-skipped case as *passed*; a grep truncated by `head -N`; check-run *names* that can't
express "this job also runs the GPU suite"; a broken PDF extractor reporting 0 for the target
*and* its controls. This is the actual rule; "don't infer from aggregates" is only its
corollary. [The real defect class: instruments where the negative and the unmeasurable render identically](../learnings/1785938354365-the-real-defect-class-instruments-where-the-negati.md)

Five instruments in one supervisor tick returned a well-formed success they could not have
earned: `gh api contents` on a >1 MB file returns `encoding:"none"`, `content:""`, **HTTP
200** (not a 413); `gh --paginate` dying mid-walk returns page 1 with the error object
spliced in; a `>= per_page` truncation guard on a *filtered* read is meaningless because a
filtered count is supposed to be short; status enums (`blocked`/`success`/`OPEN`) each mask a
conjunction; `PR.author` describes only the current head after a force-push rewrote history.
The defenses that worked: pair every zero with a control that must fire; ask "could this have
come out otherwise?" (a test that matches by construction has no possible control); read past
the field you asked for; **change the collection, not the field** (three tiers each tried a
different field on the same stale snapshot and got the same wrong answer).
[Five instruments that returned a well-formed success they could not have earned](../learnings/1785935320221-five-instruments-that-returned-a-well-formed-succe.md)

The same "correct answer, invalid evidence" shape recurs because *being right by luck is
indistinguishable from being right by method from the inside* — no internal signal ever
fires, only an outside re-measurement breaks it.

## The three (really more) failure modes of a zero

A wrong "this doesn't exist" has at least three distinct causes, needing three different
fixes — and the one everyone reflexively guards is only one of them:

- **A — output you HAD and screened out**: the answer was in your own result set; you
  screened it against the question that *prompted* the search, not the one you ended up
  asking. Fix: re-read your own output against the NEW question.
- **B1 — capped read of the right target**: truncated read; a signature exists (round-number
  total, cap value), so a bound test exposes it.
- **B2 — complete read of the WRONG target set**: read succeeded, exit 0, control on that
  target passes — and it is still a false absence. **No bound test can reach it**; the
  instrument worked perfectly on the input you handed it. Fix: enumerate and justify the
  target set *before* the search. [A complete read of the wrong target set is a false absence no control catches](../learnings/1785935180046-a-complete-read-of-the-wrong-target-set-is-a-false.md)

A fourth: the **address moved**. A grep for your own memory entry returned 0 — not data
loss, the entry had been relocated by a concurrent structural compaction and sat unharmed at
a new path. A positive control run against the same stale path would *also* come back empty;
the defect is one layer beneath the query. Remedy: resolve the container / grep the directory
/ grep for a stable identifier, never the remembered path. In any multi-writer store a path
is a moving target the same way a line number is.
[A stale ADDRESS makes absence look like data loss — resolve the path before trusting a zero](../learnings/1785892267209-a-stale-address-makes-absence-look-like-data-loss-.md)

## Six ways a grep/count returns a false zero

All six hit in one session: (1) **line-wrap** — `grep -c "phrase"` misses a phrase that wraps
across lines; (2) **empty fetch** — `gh api > f` produced 0 bytes, every grep against it reads
clean; (3) **markdown emphasis** — `not written` misses `_not_ *written*`; (4) **asymmetric
normalization** — stripped backticks from the haystack, left them in the needle; (5)
**count-as-proxy-for-meaning** — `grep -c <sha>` → 0 read as "unpinned", but the doc pinned it
in prose without repeating the sha; (6) **the mirror of 5** — a *hit* can't distinguish the
defect from a coincidence. 5 and 6 are the dangerous pair: the measurement is accurate, only
the semantic leap fails, and no control catches them — you must read the matches. Remedies for
1–4: collapse newlines before grepping prose (`tr '\n' ' '`); strip markup from *both* sides;
`wc -c` the artifact before believing any grep against it; `diff` against a known-good copy.
The **four-leg test**: invariant → 0, inverse → N (proves the predicate partitions), reconcile
(0 + N == total, no hidden third bucket), impossible predicate → 0 (the decisive leg — it
returns the same 0 as the real invariant, so without it the bare zero carried no information).
[Six ways a grep/count returns a false zero — and the four-leg test that makes a zero mean something](../learnings/1785889928610-six-ways-a-grep-count-returns-a-false-zero-and-the.md)

Anchor a grep on the **rare literal token**, letting the variable part fall outside it — this
supersedes "copy the emitted bytes" because copied bytes break when the harness reflows.
`spirv-val` alone has the same recall as `spirv-val [ 0 / 866 ]` with no spacing dependency.
Fluency is the *mechanism*: knowing `3221225477` is `0xC0000005` is precisely what makes you
type the documentation's canonical form rather than the tool's emitted bytes — expertise makes
probe error *more* likely. Worst placement: a grep recipe line that instructs a future reader
to run a pattern returning zero. [Anchor a grep on the rare literal token — fluency makes you type the wrong form](../learnings/1785918131807-anchor-a-grep-on-the-rare-literal-token-fluency-ma.md)

## A control must be independent of the failure mode

The standard remedy ("run a non-zero control") can *actively fail*. GitHub REST sub-collections
default to `per_page=30`, oldest-first, so a truncated read drops the newest rows — and a
control drawn from the same page-1 read cannot detect that page's truncation. A triager
published "inline comments today = 0" refuting a nudge, ran a 07-27 non-zero control that
returned a healthy 18 — both numbers came off the same truncated page 1. To catch truncation
the control must come from a *different page* or *different endpoint*. Corollary that cost the
most: **a correct conclusion resting on a false premise draws no correction from the outcome**
— when the verdict is inaction, audit the premise separately, because inaction generates no
failure signature. [A control must be independent of the failure mode it is meant to catch — page-boundary edition](../learnings/1785847388050-a-control-must-be-independent-of-the-failure-mode-.md)

Naming a control's defect protects nobody — you must *name the control you needed and run it*.
A probe placed inside the code path you propose to change samples a population already
conditioned on that path, so "the probe fires" establishes nothing about whether the shape
you seek could ever appear there. Ask "what input would make this fire, and can I build one?"
If you cannot construct a positive, you don't have a negative result — you have an untested
instrument. And resist the tempting universal ("a control validates the instrument, not the
sampling frame") — it's wrong (a control *can* interrogate a frame if chosen to) and it gets
cited later to justify *skipping* a control. [Addendum: name the control you needed, don't generalize about controls](../learnings/1785887994924-addendum-name-the-control-you-needed-don-t-general.md)

## Change the method; carry a control that must fire

Four agents in one night each confirmed diagnostic code 115 was free in a Lua file and each got
the evidence wrong — every matcher fixed one axis (constructor name OR line layout) while
believing it was "formatting-agnostic". Naming an axis invites you to stop enumerating axes.
What worked: enumerate at the **chokepoint** where axes collapse (all six constructors funnel
into one `add_diagnostic`). Rules: change the method don't re-run it; carry a positive control
that MUST fire *plus* a negative that must not — a matcher that silently drops far-away values
cannot support a claim that nothing is nearby; read your own message for self-contradiction
before sending. **The category that predicts error is *unopened*, not *risky-looking*.**
[Re-measure by a DIFFERENT method with a control that must fire — naming an instrument defect protects nobody](../learnings/1785896112384-re-measure-by-a-different-method-with-a-control-th.md)

## A control validates the instrument, never the target or the currency

Three orthogonal axes, each passing says nothing about the others: the **non-zero control**
(does the mechanism work?), the **currency check** (`created_at` on the newest row — is this
object still the one in use?), and the **scope check** (does the window contain the events
I'm claiming about?). A valid control on a *retired* workflow id proved the endpoint responds
— which was never in doubt — while the job had moved elsewhere entirely.
[A non-zero control proves the endpoint responds, not that the object is current](../learnings/1785858873454-a-non-zero-control-proves-the-endpoint-responds-no.md)

An **empty population is byte-identical to a total mismatch**: a comparison harness whose copy
resolved `REPO_ROOT` to `/` walked nothing, returned zero files, and diffed an empty dict
against a populated one — rendering as "53 of 53 files differ", a flat contradiction of the
author's checkable claim. The audit was skipped *because the result confirmed nothing it
wanted* — a dramatic result that disagrees with someone is as unguarded as a zero that agrees
with you, because disagreement reads as rigor. Assert population size is non-zero before
interpreting any comparison; assert env-derived roots are equal across both arms.
Companion **mutation check**: to prove a guard has teeth, seed the exact defect it exists to
prevent and confirm it fails on the right thing. [An empty population is byte-identical to a total mismatch — audit the instrument before believing a dramatic contradiction](../learnings/1785862178931-an-empty-population-is-byte-identical-to-a-total-m.md)

## Two channels launder a shell failure; probe absence with a decoy

`2>/dev/null` kills the stderr message (exit code still nonzero); **any pipe** kills the exit
status (a pipeline reports only its last stage). Suppress stderr *and* pipe, and a hard HTTP
400 becomes an indistinguishable "no results". Fix: `set -o pipefail` (or `PIPESTATUS[0]`)
AND leave stderr visible — one guard covers only one channel. General rule: **when you catch
yourself explaining an artifact, first check the artifact is real** — the explanatory reflex
fires before the verification one. [Two independent channels launder a shell failure: 2>/dev/null kills the message, a pipe kills the exit status](../learnings/1785867928996-two-independent-channels-launder-a-shell-failure-2.md)

**Discriminate with a decoy, not a repeat.** A gateway 502 for `gitlab-master.nvidia.com` was
byte-identical (98 bytes) to the 502 for an invented hostname — so it could not distinguish
"firewalled by design" (terminal) from "no allow-rule configured" (routable). No HTTP status
carries intent. Feed the instrument something known-absent and something known-good; if the
known-absent case returns the same bytes, the error is indiscriminate. And **replication is
not corroboration**: two agents reproducing the same uninformative string share an instrument,
not a conclusion — agreement adds zero bits about the cause. When adopting a peer's negative,
run your own *control*, not the same probe. [An error that is byte-identical for a host you invented cannot tell you why a real host failed — test with a decoy, not a repeat](../learnings/1785942287242-an-error-that-is-byte-identical-for-a-host-you-inv.md)

## A zero applies to instruments and harnesses too, not just searches

The "positive control" rule silently fails to transfer to instruments and for-loops, because
*a probe feels like an instrument; a for-loop feels like plumbing — both are instruments*. A
single-counter probe returning `0` is ambiguous three ways (safe / never-occurred /
never-reached); the fix is **graduated counters with the control nested one step from the
discriminator** — a distant control ("did anything run?") and a nested control ("does the
probe reach the *family* the question is about?") are not interchangeable. A 400-file sweep
reported `merges=0` having measured *nothing* — every invocation failed on `-o /dev/null`
requiring `-entry`; the cheap guard is to print how many invocations *succeeded*. And **don't
run a control you can't interpret**: at a ~1-in-11 crash rate, ~6 clean runs have a ~60% chance
of showing zero even if the rate is identical — an underpowered control launders rather than
exonerates. Related traps: `$?` for `slang-test` (exits 0 on failure), `command -v` for
availability (false-absent for an unpathed tool), `git diff --stat` blind to untracked files,
`pgrep -f` matching the waiter's own command line, `ls` after `cp`.
[A zero without a positive control applies to INSTRUMENTS and HARNESSES too, not just searches — and nest the control one step from the discriminator](../learnings/1785874011041-a-zero-without-a-positive-control-applies-to-instr.md)

## An implausible number beats re-reading the filter

Auditing 7 days of CI reruns, a leaky filter (`result == "left"`, allow-listing one value of
an 11-value open vocabulary) credited one PR with 17 reruns under a 3/day cap — near
arithmetically impossible, and *that implausibility*, not any code review, found the bug.
Rules: **deny-list the non-actions, never allow-list one** (enumerate the value distribution
first with `Counter(...)`); sanity-check a derived count against a known constraint; pair the
filter with a known-nonempty control that MUST survive it; **keeping the RULE but not the
VALUE forces re-derivation, where fresh error enters** — store the value, its date, and its
method next to the rule. [An implausible number is a stronger bug signal than re-reading your filter code](../learnings/1785867938225-an-implausible-number-is-a-stronger-bug-signal-tha.md)

`actions/runs?head_sha=` silently returns `total_count: 0` (HTTP 200) for a **truncated** sha —
so a pipeline storing `sha[0:8]` for both `check-runs` (which resolves prefixes) and the runs
query gets real data from one and manufactured green from the other. A phantom-red detector
reported "TRULY RED: 0" across 24 PRs; the tell was implausibility (a PR it had read as failing
minutes earlier). The failure is asymmetric — it manufactures **green, never red**. Rules:
`assert len(sha)==40`; treat `total_count==0` as UNRESOLVED not "no failures"; keep a known-red
control row inside the loop. [actions/runs?head_sha= silently returns ZERO rows for a TRUNCATED sha (HTTP 200)](../learnings/1785881680695-actions-runs-head-sha-silently-returns-zero-rows-f.md)

## Self-catching requires two facts in tension

A single measurement is self-consistent by construction; re-reading it returns the same answer
with more confidence attached — worse than useless, because confidence suppresses the next
check. Only two independently-obtained facts can *disagree*, and disagreement is the only
signal that originates from inside. On one chain, six of seven instrument failures were caught
by a *different* agent; the single self-catch came from an implausibility ("never built"
contradicting a successful `import`). Before an irreversible step, ask not "am I sure?" but
"what independent fact would be inconsistent if I'm wrong?" Corollary: **review capacity is the
primary detector, not redundant overhead** — your own clean self-review is close to zero
evidence, so weight a peer's contradicting measurement above your own confirming one, even
downstream. [Self-catching requires two facts in tension, not more diligence on one](../learnings/1785892450870-self-catching-requires-two-facts-in-tension-not-mo.md)

## Proving a null-function-pointer crash with no debugger

When a source read cannot settle crash-vs-hygiene (severity hinges on reachability) and no
debugger is available: stub the shared library omitting exactly one symbol (verify the stub
with `nm -D` first — a stub you didn't check is not a control), capture the fault with
`LD_PRELOAD` + `SA_SIGINFO` reading `RIP`. The counter-intuitive part: `backtrace()` returning
only 2 frames **is the evidence** — calling through a null function pointer sets PC to 0, so
there is no frame to unwind, and `RIP=0x0` distinguishes it positively from a data null-deref.
Both controls (real-lib and 1-module) are load-bearing; a cell that fails identically in both
arms carries zero information. [Proving a null-function-pointer crash: stub .so + SA_SIGINFO, and why a truncated backtrace IS the signature](../learnings/1785902291294-proving-a-null-function-pointer-crash-stub-so-sa-s.md)
