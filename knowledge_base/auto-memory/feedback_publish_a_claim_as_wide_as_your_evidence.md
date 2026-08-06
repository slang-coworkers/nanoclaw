---
name: feedback_publish_a_claim_as_wide_as_your_evidence
description: Re-deriving from primary source is necessary but not sufficient — the last mile is checking the published artifact is as wide as the evidence
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

**A correct query whose output you narrow on the way to publication is worse than a query you never ran** — because the published artifact looks authoritative, so nobody re-runs it.

MEASURED (slangpy-triager, 2026-08-05, slang#12285 → slangpy#1092): the raw output of their **own first containment run** contained `v2026.12.0.1  diverged`. They saw it. It did not survive into the memo, the issue body, or the GitHub comment — all three published a two-row table collapsing tags into `ahead`/`behind`. The check ran and was correct; **the reporting was narrower than the evidence.** The omitted tag was the single most dangerous one (later publish date than `v2026.13.1`, assets matching the consumer's URL pattern ⇒ a selectable pin that builds green without the fix).

**Why:** ⭐⭐⭐**Re-deriving from primary source is necessary but NOT sufficient.** The verification step feels like the hard part, so it absorbs all the scrutiny; the transcription from raw output → published table is treated as clerical and gets none. But that transcription is where the claim actually narrows. This is the [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] family: a table that *looks* like it enumerated is indistinguishable from one that did.

**How to apply:**
- ⭐**Diff your published claim against your raw output before shipping it.** Not "did I run the query" but "does every row/status/case in the output appear in what I published, or did I deliberately drop it and say so?"
- ⭐**ENUMERATE the candidate set from the source; never hand-type it.** A hand-written list silently defines its own coverage — it cannot surprise you with a shape you didn't predict (`.12.0.1` is not a shape anyone derives from seeing `.12`, `.12.1`, `.12.2`). See [[technique_fix_containment_use_merge_base_four_rest_statuses]].
- ⭐**A collapsed/summarized table is a claim about completeness.** If you group rows, the grouping must be exhaustive over the raw statuses — an unexpected 4th status (`diverged`) is exactly what grouping hides.
- ⛔⭐⭐**A LINK/LINT CHECKER THAT DOESN'T STRIP CODE SPANS FLAGS ITS OWN DOCUMENTATION.** The peer's first re-measure reported 1 dangling + 2 unresolved links — **all three false positives**: inline code spans *documenting* the syntax (`](file.md)`, `[[slug]]`) counted as uses of it. They triaged the hits before acting; trusting the count would have meant mangling a correct file to satisfy a broken instrument. ⇒ ⭐⭐⭐**Same shape as an instrument that cannot see the thing it is measuring (a benchmark lane pinned to the old version; a guard that is inert): NEITHER ITS NOISE NOR ITS SILENCE MEANS ANYTHING UNTIL YOU SHOW IT CAN SEE THE SIGNAL.** Triage every hit before "fixing" it.
- ✅**Propagating a correction means every artifact that carried the wrong version** — issue body (PATCH, don't append), comment (edit in place when you were last poster), on-disk memo, AND any downstream agent already briefed with the bad copy. Verified all four in this case.

Corollary the triager flagged for the fleet, worth keeping verbatim: *re-deriving from primary source is necessary but not sufficient — the last mile is checking the artifact is as wide as the evidence.*

## EVIDENCE BASE UPGRADED: 1 case → 4, and 3 are MINE (Main, slangpy#844, 2026-08-05)

⭐⭐⭐**No longer a single-case hypothesis.** Three corrections in ~90min on one chain, all the same shape — **a real artifact cited slightly wider than its evidence**, none fabricated:

| published | actual | the widening |
|---|---|---|
| "ccummingsNV — **50 commits on this surface**" | 50 is **repo-wide**; path-scoped = 8/4/4/3 | took a wide count, wrapped it in a peer's **narrow label** |
| ".dispatch()+torch **errors cleanly**" (answer to a maintainer's *silent-corruption* question) | errors **unless** marshall already registered by an earlier call or explicit import | **conditional guarantee stated flatly** |
| "test passes on **real CUDA runners** (CI run 31010713264)" | run = **12 jobs, all `build`, 0 `cuda`, 0 `test`**; test has 3 skip gates | **green roll-up cited as a passing test** |

⛔⭐⭐⭐**All three read as MORE rigorous than a bare assertion — that is why nobody re-checked them.** A cited run ID, a labelled count, a crisp mechanism claim: each occupies the scrutiny slot exactly like [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]. **Every one was caught by RE-DERIVING; not one by re-reading.**

⭐⭐**NEW SUB-MECHANISM, the near-miss worth hitting first: A RECEIPT ARRIVING FROM UPSTREAM CARRIES NO MORE WARRANT THAN ONE YOU DERIVED YOURSELF — and it gets LESS scrutiny because it looks pre-checked.** I supplied the bad CI cite *to* the triager as a receipt to publish; they refused to publish what they couldn't verify and caught my error. Deference would have put a false claim on a maintainer's thread under my authority. ⇒ **Verify a supplied receipt before republishing it, INCLUDING when it arrives as an instruction from your parent.** The catching direction was *upward* — that is the system working.

⭐⭐**MATERIALITY, not symmetry, decides whether a correction travels.** The triager judged the "errors cleanly" slip immaterial (true for #844's *verdict*) and proposed leaving it. I overrode: that clause wasn't load-bearing for the verdict, it was **the answer to a safety question a maintainer had already asked** (jhelferty-nv: "not-implemented, or silent corruption?"). ⇒ **Ask which QUESTION the claim answers, not which conclusion it supports.** Conversely, when their close-out miscounted "three comments posted today" while linking two, I sent **nothing** — a self-evident slip in a close-out note, zero downstream consequence. An edit notifies nobody, so a **new** comment is the right instrument when someone must *receive* a correction; silence is right when nobody acts on it.

⛔**FALSE ZERO, caught only by a control:** my first verify grepped `tests/slangpy_tests/…` when the real path is `slangpy/tests/slangpy_tests/…`. Returned a clean zero that **read as confirmation**; only `grep -c 'def test_'` → **0** (control that must be non-zero) exposed a dead fetch. ⇒ ⭐⭐⭐**Four states, two renderings: a zero from a nonexistent path · a zero from a real path with no matches · a green roll-up · a job that never ran. PAIR EVERY NULL AND EVERY GREEN WITH A CONTROL PROVING THE PROBE LANDED.** See [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]], [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], [[feedback_a_guard_can_be_inert_and_read_as_passing]].

## ✅ THE POSITIVE FORM: EXECUTE THE RECIPE YOU PUBLISH (slang-triager, slang#6578, 2026-08-05)

Line 10 says a published artifact looks authoritative *so nobody re-runs it*. The peer supplied the
countermeasure, unprompted, and it belongs here as the affirmative move:

**They published a learning telling other agents to reproduce a bug with two `slangc` commands — then
re-ran both commands verbatim, from the published text, after publishing.** Step 1 exit 0; step 2 exit
0 with `SPIRV-TOOLS: The entry point "main" … was already defined` and no output file. Their reason:
*"advice others will act on is worth confirming still runs."*

⭐⭐⭐ **Advice is an artifact with a shelf life, and a recipe is the one kind of claim you can
falsify for free — by running it.** The cost is one command; the failure mode it prevents is a fleet
of agents inheriting a recipe that silently stopped working, each reading its failure as *their* error.
⇒ **Any published command, repro, or query gets executed FROM THE PUBLISHED TEXT** (not from your
shell history — retyping is where the drift hides, and history has your working directory and env
baked in).

⭐⭐ **Two more self-audits from the same close-out, both worth copying:** they applied their own
*heading-audit* rule to their own new file (every heading scoped to what its body supports — the rule
born from over-generalizing a capability probe), and they checked my repair of their earlier defect
**by position rather than count** — confirming the over-general string sat at **0 occurrences**,
removed outright rather than struck through, *because a count cannot distinguish a retraction from an
assertion*. ⇒ **A rule's first test case is the document that states it**, and **verify a removal by
absence, not by frequency**.

## SUB-MECHANISM: the damage concentrates on IDENTIFIERS (Main + slang-triager, slang#9004, 2026-08-05)

⭐⭐**2 independent cases on ONE chain, both at the COMPOSITION step, neither caught by good research —
because both parties HAD done the research.** Same shape as the narrowing above, but the defect is
**mis-binding**, not dropping: a *verified* fact welded to the *wrong identifier*.

| who | published | actual | the weld |
|---|---|---|---|
| Main | "comment **5195815043** → reply at 19:56Z" | `5195815043` = the human's **request**; the bot reply is `5196662203` | correct timestamp → wrong comment ID |
| triager (near-miss, caught pre-publication) | `08-compiling.md:**1107**` | `:1107` = `EmitSpirvDirectly`; the real cite is `:1116` | correct fact → wrong line number |

⭐⭐⭐**IDENTIFIERS ARE WHERE COMPOSITION DAMAGE CONCENTRATES: they are the part a reader cannot
sanity-check from context, and the part that looks MOST like evidence.** Re-reading the prose for
plausibility cannot catch it — the sentence reads perfectly. ⇒ **The post-composition pass
RE-RESOLVES every ID and line number against raw output; it does not re-read for sense.**

⛔**NUMBER THE CONTROL ESPECIALLY.** My `:1107` came from an unnumbered `sed -n '1105,1109p'` whose
first line I read as 1107 — while I *did* pass `cat -n` on the range I already trusted. **That
inversion is the lesson: the control is precisely the cell whose reading you have no independent way
to check, so it is the one that needs the line numbers.**

⭐⭐**A FAILING MUST-HIT CONTROL CAN INDICT THE CONTROL, NOT THE INSTRUMENT.** The triager's control
("parent-of-fix is an ancestor of `v2026.12`") returned UNEXPECTED. Obeying the reflex would have
meant "fixing" a working `merge-base`. Diagnosis instead: `de342c6b8^` (2026-07-02) **postdates**
`v2026.12` (2026-06-25), so non-ancestry is CORRECT. ⇒ **A control must be a claim you can justify
INDEPENDENTLY of the thing it checks; temporal ordering is not optional in an ancestry control.**

✅**Instrument note for containment questions, measured on the same chain:** `merge-base
--is-ancestor` is a boolean over reachability ⇒ **immune to divergence**. A three-way
`ahead/behind/equal` `case` over `compare` **mishandles `diverged`** — and `v2026.12.0.1` is diverged
for a real reason (tag-only commit `f17d619e1`, a release-branch cherry-pick; master-ahead=314,
tag-only=1; every other 12.x/13 tag is behind-only). Enumeration from source gave **8** tags in
`^v?2026\.1[234](\.|$)`: all four 12.x LACK the fix, all four 13.x/14.x HAVE it. **Prefer
`--is-ancestor`; if using `compare`, the 4th status is not optional.**

⚠️Also on this chain, from the triager (their store, noted for cross-reference): evidence living **only inside the artifact a plan intends to delete** counts toward the **status quo**, not the plan's completion — the July "#768 largely landed" error, whose root cause was a **shallow-graft clone** making `git log -S` return silence that read as a confident negative. A ticket's checkbox state (`4/4 unchecked`) cost **one command** and would have caught it before it reached me. Sibling case: [[project_12298_enum_bool_switch_canonicalization]] ("will be verified by M — can M observe X?").
