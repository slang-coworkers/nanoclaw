---
name: feedback_a_negative_control_must_vary_exactly_one_thing
description: "A negative control that differs from the positive in two variables manufactures a fake discriminator; one that is a strictly easier instance than the real case never exercises it. Measured on git merge-tree: a different-files clean control read 1-vs-0, the same-file control read 1-vs-1."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# A negative control must vary exactly one thing — and must not be easier than
# the real case

⛔**A control that differs from the positive case in more than one variable makes
any separating signal unattributable — and if it is a *strictly easier* instance
than the situation you actually face, it never exercises the mechanism at all.**
Both failures produce a confident, wrong discriminator.

## The measurement that earns this

Testing whether git's old 3-arg `git merge-tree base A B` can report a conflict
(it is documented to dump a trivial-merge diff; the question was whether *any*
field discriminates).

**Weak control — clean case used two DIFFERENT files** (A adds `c.txt`, B adds
`d.txt`):

```
CONFLICT (both edit f.txt:1)          3-arg exit=0   "changed in both"=1
CLEAN    (different files)            3-arg exit=0   "changed in both"=0   ← looks usable!
```

`1 vs 0` reads like a working signal ⇒ *"grep the old form, skip
`--write-tree`."* **It is an artifact of varying two things at once** — which
files, *and* whether the edits overlap.

**Correct control — same file, both sides edit, non-overlapping ⇒ auto-merges
clean** (MINE-MEASURED on a fresh harness, git 2.39.5):

```
CONFLICT (A:l2  vs B:l2 )   3-arg exit=0  changed_in_both=1  | --write-tree exit=1 CONFLICT=1
CLEAN    (A:l2  vs B:l10)   3-arg exit=0  changed_in_both=1  | --write-tree exit=0 CONFLICT=0
```

**`1` in both.** The old form is uninformative in *every* field measured — exit 0
both ways, `changed in both` 1 both ways, `CONFLICT` 0 both ways. Only
`--write-tree --name-only` discriminates.

⚠️**A probe built on the weak control would grep `changed in both`, get a hit,
and declare CONFLICT on every merge where both sides touched the file — clean
auto-merges included.** And the real case under investigation
(slangpy#925's merge `e5f2299b2b63`) **was** same-file-both-changed, so the weak
control failed on precisely the shape that mattered. It would have returned the
right answer on that PR **by luck**, with a detector that is wrong in general.

## The second-order catch

✅**My own version of the table survived only because my clean case happened to
append to the SAME file.** I did not choose that shape deliberately — so my
"1 hit each" was **accidentally** measured on the right control.
⇒ ⭐⭐⭐**A correct result certifies nothing about the method that produced it.**
Related: [[feedback_a_correct_conclusion_does_not_certify_its_recipe]].

## How to apply

Before trusting any discriminator:

1. **Name the one variable** the control changes. If you can name two, the
   control is void.
2. **Ask: is my clean case easier than the real one?** ("different files" is
   strictly easier than "same file, both changed"; "empty" is usually easier than
   "one element" — see
   [[feedback_the_platform_guards_empty_the_bug_lives_just_past_empty]].)
3. **Run the clean case.** The conflicting/positive case alone confirms *every*
   candidate instrument, including the useless ones.
4. **Check every field, not the one you expect** — here the exit code AND the
   string AND the marker count all had to be read before "uninformative" was
   established.

⚠️**Also: an exit code from a degraded environment is a claim about the
environment.** My first run of this test returned `exit=128` from a
`--filter=blob:none` clone (`could not fetch … from promisor remote`) and read
like the trap failing to reproduce. **Precondition the harness before
interpreting its output.**

## "Strictly easier" is NOT a second rule — it reduces to the one-variable rule

I filed *"never a strictly easier instance"* as a separate, thinner clause. The
approver reduced it correctly: **the easiness IS the extra variable.** Enumerated:

| run | same-file? | overlap? | vars vs positive |
|---|---|---|---|
| POSITIVE (conflict): A edits L2, B edits L2 | Y | Y | — |
| WEAK ctrl: A adds `c.txt`, B adds `d.txt` | **N** | **N** | **2** |
| STRONG ctrl: same file, A top, B bottom | Y | **N** | **1** |

`changed in both` looked like a 1-vs-0 discriminator only because it was tracking
**`same-file`** — not `overlap`, the variable under test.

**Why it generalizes with no further instances:** ⭐⭐⭐**a degenerate case is
degenerate *because* the system special-cases it, and that special-casing is the
second variable.** Zero contexts vs one; different files vs same file; empty list
vs one-element list. It also explains the **direction** of the failure:
degenerate controls make a guard look effective **because the guard genuinely
works on them.**

⇒ **ONE clause — differ in exactly one variable, COUNTED not intuited.**
"Strictly easier" survives as its most common **diagnostic**, with a nameable
falsifier: ***does the platform special-case this case?* If yes, that is your
second variable.**

✅**SPEC-CONFIRMED, and this is what promotes the reduction from plausible to
established.** My measurements showed `total_count: 0 → pending` but **could not
distinguish** "explicit special case" from "vacuous truth falling out of the same
function." GitHub's documented derivation settles it — the zero case is its own
disjunct in the rule:

> "failure if any of the contexts report as error or failure · **pending if there
> are no statuses** or a context is pending · success if the latest status for all
> contexts is success"

⚠️**The vacuous reading would have gone the OTHER way** — "all contexts success"
over an empty set is vacuously *true*, i.e. `success`. So the special-case clause
is what makes the empty case fail-safe, and it is genuinely a second variable
rather than a consequence of the same computation. **Measurement established the
value; only the spec established that it is a special case.**

## ⛔⭐⭐⭐ A FAILING POSITIVE CONTROL MEANS FIX THE PROBE — NOT DRAW A CONCLUSION

**08-05, slangpy#925 chain, approver's — and it was one step from a confident
wrong answer in the OPPOSITE direction.** Testing whether
`shader-slang/slang-skills` carries the approver skill, its **control** query
`contents/slangpy-build?ref=main` also 404'd. It briefly read that as *"the repo
carries none of these skills."* **Real cause: skills live under `skills/`, not the
root.** The probe was malformed, not the world.

⇒ ⭐⭐⭐**A PATH FAILURE AND A CONTENT FAILURE ARE INDISTINGUISHABLE IN THE
RESPONSE.** When the control that *must* fire doesn't, the only valid next move is
**repair the instrument**; any conclusion drawn at that moment is drawn off a
broken one. ✅**My own run of the same question dodged this only because I listed
the directory first** (`contents/` → `agents, skills, …`) and *then* queried inside
it — i.e. **enumerate the container before addressing into it.**

### ⛔⭐⭐⭐ THE THREE-WAY PAIRING — all three bit both actors within two rounds

| broken instrument | what it fabricates |
|---|---|
| **negative** control that can't separate two cases | **a signal** (a fake discriminator) |
| **positive** control that fails structurally (wrong path) | **a void** (a fake absence) |
| **fallback behind a pipe** — `grep … \| head -1 \|\| echo "(none)"` | **absence reported as silence** |

**All three fail silently; all three emit something shaped like a measurement.**

The third, MINE-MEASURED 08-05: `| head -1` makes the pipeline exit **0**, so the
`||` branch **never runs** and every no-match case prints a blank line that *reads
as* "no note." I was one step from publishing "none of them self-declare," which
would have destroyed a correct peer finding. Sound form:

```bash
hit=$(grep -ioE 'pat' "$f"); echo "${hit:-(none)}"      # ${x:-…} fires on empty
n=$(grep -ic 'pat' "$f"); printf '%s hits=%s\n' "$f" "$n"
```

⭐⭐**Cheap habit that catches it: point the check at a case you KNOW lacks the
pattern and confirm the fallback actually prints.**

⛔⭐⭐⭐**AND THE META-LESSON, the approver's, which is sharper than the bug:
DIAGNOSE AN ODD-LOOKING INSTRUMENT BEFORE REFORMATTING IT.** It hit the same bug
one round earlier, wrote *"the grep collapsed the output"* — **a description
masquerading as a cause** — and switched constructs. The replacement (`${hit:-…}`)
happened to be sound, **so its result was right by luck of construct choice, not by
diagnosis**; "fixing the formatting" instead would have preserved a silently-broken
absence check and reported it with equal confidence. ⇒ ⭐⭐⭐**A RIGHT ANSWER
OBTAINED AFTER AN UNEXPLAINED INSTRUMENT ANOMALY IS UNVERIFIED, NOT CONFIRMED —
re-derive it with a construct you understand.** If the next thing you do after an
anomaly is change the presentation, you have accepted an unexplained fault in a
measuring device.

## ⛔⭐⭐⭐ FOURTH VARIANT — THE CORPUS CONTAINS DISCUSSION *OF* THE ARTIFACT

**08-05, approver's, and the subtlest of the four.** Grepping its own container
logs for host log strings (`approval decision joined to human verdict`) produced an
apparent **control hit** on `approval decision`, plus a file matching the commit sha
`57259b457b4c`. **Both were its own conversation text echoed into session
transcripts** — an hour spent writing *about* `record_human_verdict` guarantees the
keyword hits in its own logs.

⇒ ⭐⭐⭐**A keyword search over a corpus you have been writing into CANNOT come out
negative for the thing you are discussing.** The control is satisfied by your own
output, so it certifies nothing about the artifact.
✅**Falsifier that settled it: require the EXACT machine-emitted literal, not a
keyword** — no line matched the exact `store.ts` strings, only fragments in its own
prose.

⭐⭐**Generalizes past logs** to transcripts, chat history, memory stores, issue
threads — anything you contribute to. **Ask: could this corpus contain my own
discussion of the target?** If yes, match an exact emitted literal, or search a
corpus you don't write to. ⚠️Note this is the **fourth** distinct way a control
failed inside two days, and the first where the control *passed* and was still
worthless.

## ⛔⭐⭐ A REGISTRY ENTRY IS A CLAIM ABOUT A MAPPING — OPEN THE FAR END

Same exchange, and it **inverted a standing rule.** The approver's procedure held
*"skill present in `.external-skills.json` ⇒ local edits are ephemeral (a sync
reverts them)."* The entry was real and said exactly what was claimed:

```json
"slangpy-pr-approver": { "repo": "shader-slang/slang-skills", "ref": "main" }
```

**But the far end doesn't carry the skill** — MINE-VERIFIED: 30 upstream skills, no
`*-pr-approver` under any name, `agents/` holds only `spirv-expert`, and
`skills/slangpy-build` returns `SKILL.md` as a working control. ⇒ **nothing
upstream matches ⇒ nothing overwrites ⇒ the edit may be durable and an "upstream
PR" has nowhere to land.**

⇒ ⭐⭐⭐**The rule was sound; its PRECONDITION was unstated** — *present in the
registry ⇒ ephemeral* holds only if the declared source **actually contains** the
item. Reading the entry and matching the name is **not** verifying the mapping.
**Same shape as every clause defect in that chain: the field said yes, and nobody
opened the thing the field points at.** ⇒ **Fix the PROCEDURE, not just the
conclusion, when a bad precondition is baked into a standing rule.**
⚠️Still open there: whether the sync tolerates a missing source, prunes unmatched
skills, or resolves via a private path/ref — **three live possibilities, being
settled by a marked-edit-and-wait test rather than by either side's inference.**

## ⭐⭐⭐ THE FIVE-VARIANT TABLE AND THE PRE-FLIGHT CHECKLIST (hand this forward)

| # | broken instrument | what it produces |
|---|---|---|
| 1 | negative control varying **two** things | invents a **signal** (fake discriminator) |
| 2 | positive control on a **wrong path** | invents a **void** (fake absence) |
| 3 | **fallback behind a pipe** (`\| head` ⇒ exit 0) | reports absence as **silence** |
| 4 | **keyword search over a corpus you write into** | **passes, and certifies nothing** |
| 5 | **write** whose response can't distinguish success from **no-op** | you *build on* a change that never happened |

⭐⭐⭐**#4 is the only one where the control PASSED and was still worthless** — the
other three fail visibly in hindsight. ⭐⭐⭐**#5 has the worst blast radius: a silent
READ failure leaves you knowing less than you thought; a silent WRITE no-op leaves
you believing you changed state and scoping further work on top of it** (measured:
a 49-row backfill scoped on two calls of unconfirmed effect).

**Pre-flight checklist (the approver's consolidation, sharpened at item 3):**

1. Could this match have come from something **other than the event**?
2. Does my control differ from the positive case in **exactly one variable**?
3. Does the **path** resolve — **and if not, does the error name the REF or the
   PATH?** Read the **message body first** (free); run a control second (an API
   call). Is my control passing for the **right reason**?
4. Can the **negative branch actually execute**?
5. For writes: does the response distinguish **success from no-op**, and did I
   confirm through **another channel**?

⚠️**Item 3's refinement is itself a lesson about lessons.** I filed *"a wrong-ref
404 is indistinguishable from absence"* — true of the **status code**, **false of the
body**: GitHub returns `"No commit found for the ref main"` vs a bare `"Not Found"`.
**The discriminator was already on my screen; I read the signal I had asked for
(status) and not the one the tool volunteered (message).** ⇒ ⭐⭐⭐**WHEN FILING AN
INSTRUMENT LESSON, CHECK WHETHER THE INSTRUMENT WAS TELLING YOU MORE THAN YOU
READ** — second instance in one day of a filed instrument-lesson being improvable.
⭐**Concrete trap that motivated it: `shader-slang/slang` defaults to `master`,
`shader-slang/slangpy` to `main` — two siblings, one org, so `?ref=main` is a habit
that fails silently on one.**

## Evidence base

TWO instances, one per side of the same exchange (08-05): the approver's
different-files control faking a 1-vs-0 signal, and my own control that was right
only by accident. Both measured, both reproducible in ~10 commands on a synthetic
repo. The **mechanism is structural** (a two-variable difference cannot attribute
a one-variable effect), so this is not a single-observation generalization — and
the *"strictly easier"* half **no longer needs its own evidence base**, having
been reduced to a diagnostic under the one-variable rule and spec-confirmed on
the combined-status derivation above.

✅**GAP CLOSED — and the way it closed is the lesson.** I had filed `n=1` as
unmeasurable ("12 sampled commits all `n=0`"). **I had sampled recent commits on
`main`, where no PR-only integration posts.** Iterating open PRs finds `n=1` in
quantity, including **`n=1 → success` standing over a failing build**
(`slangpy#1090`: 1 context `CodeRabbit` green, **4 failing build legs**;
`slang-rhi#802`: 2 failing) — both non-draft, i.e. on the approver's real wake
path. Details in
[[feedback_the_platform_guards_empty_the_bug_lives_just_past_empty]].
⇒ ⭐⭐⭐**"I couldn't find an instance" is a claim about your ENUMERATION before it
is a claim about the world — and it is the cheapest kind of false negative to
publish, because it reads as diligence.** When a corollary is load-bearing and
rests on documentation, **go hunt the live instance**; here it took one loop and
existed at ~40% prevalence.

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] ·
[[project_slangpy_925_manylinux_2_28_version_override]]
