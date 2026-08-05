---
name: feedback_reversing_a_correct_position_under_a_defective_input
description: "Corrections, authority and dispatch: reversing a CORRECT position under a defective input (retract the DISPATCH, keep the POSITION) · the dispatch-conflict procedure — surface both verbatim, refuse to arbitrate, DEFER-UPWARD IS NOT SAFE · a correction carries borrowed credibility, worst as a characterization of an artifact only the sender can see ⇒ quote, don't describe · THE WRONG ARTIFACT — a flawless measurement of the wrong object reads as correct; measure at the PR's SHA · over-hedging is unsafe when a human's risk decision reads your confidence · THE EDIT THAT INSTALLS A RULE IS LEAST LIKELY TO HAVE IT APPLIED · a rule held is not a rule fired"
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - corrections
    - authority
    - dispatch
    - review
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# Reversing a correct position under pressure from a defective input

**#11616/#11617, 2026-08-04.** Not the usual "claim outran its evidence" — **the opposite failure**, and
it happened twice in one exchange, to two different tiers, from two different kinds of defective input.

| tier | the defective input | what was abandoned |
|---|---|---|
| slang-fixer | a **bad measurement** (plain `[ForceInline]` shows no serialized restore scope ⇒ generalized to all inlining) | a correct architectural position |
| slang-triager | a **procedural correction** it allowed to function as a technical one | the decisive merits argument, which it held |

**In both cases the abandoned state was the right one.** ⇒ this earns its own name; the tell is that
**you can name what you gave up.**

## The rule

⭐⭐⭐ **PROCEDURAL DEFERENCE IS NOT A SUBSTITUTE FOR A MERITS JUDGMENT.** slang-triager held the
decisive argument (*pdeayton reserved the naming, and you cannot ship an opcode without naming it*) and
dropped it on discovering it had broken a *process* rule (dispatching on a chain where I held the
dispatch line). ⇒ **Retract the DISPATCH, keep the POSITION** — route the position through whoever holds
dispatch. Those are separable and collapsing them inverts the technical call.

⭐⭐⭐ **THE CORRECTION YOU DON'T CHALLENGE IS THE ONE THAT CONFIRMS YOU WERE WRONG** — and a correction
arriving dressed as *process* rather than *evidence* gets the least scrutiny of all. Triager's own
diagnosis: it challenged my dispatch while the conflict was technical, then stopped challenging the
moment it felt procedural. That is an appeal to authority over evidence, committed one message after
flagging the same substitution in my ruling.
Sibling: codex "corrected" the fixer's self-correction (claimed empty-stdout pipes; both commands had
`2>&1`) and withdrew — **corrections need checking in BOTH directions.**

## The dispatch-conflict procedure (earned the hard way)

Four instructions reached one coworker in minutes: (1) mine *implement, don't wait* — **wrong**;
(2) triager's *don't start* — **correct**; (3) triager's withdrawal, *follow parent* — **wrong**;
(4) my reversal — correct. **The fixer refused to arbitrate both times, and that refusal is the only
thing that stopped the rework.**

⛔⭐⭐⭐ **"DEFER UPWARD" IS NOT A SAFE DEFAULT — upward was wrong first.** Deferring to me would have
started the rework; deferring to the triager after its withdrawal would have started it an hour later.
The standing response is a **procedure, not a hierarchy**:

> **Surface both instructions verbatim, refuse to arbitrate, name the cost asymmetry.**

⭐⭐ **The rule survived because the DEEPEST tier enforced it** — the tier with the least authority was
the only reliable party. A dispatch rule that only the top can enforce does not survive the top being
wrong.
⇒ Tell downstream coworkers explicitly: *this applies even when the conflicting instruction comes from
me*, and *a later message from me supersedes an earlier one only when it says so.*

## The companion containment failure

⭐⭐⭐ **A CHECKLIST APPLIED TO THE WRONG OBJECT IS INDISTINGUISHABLE FROM NO CHECKLIST**
(slang-triager's line, adopted verbatim). We ran the 9-dimension containment check on the **push**
(path · extension · status · authorship · resolved committer · push-vs-server-side · which App · 7a · 7b)
and never on the **fix** — where the missing dimension, **serialization / ABI**, was the only one that
mattered. Generalized: **we instrumented the delivery mechanism and left the artifact's own correctness
on intuition.** The `pr: non-breaking` label rested on variable-arity being safe, verified against
*source composition* with #12148 and never against serialization.
⇒ Belongs next to the checklist itself, or the next reader runs it on whatever object happens to be in
front of them. See [[feedback_control_the_instrument_not_the_reasoning]].

## ⭐⭐⭐ OVER-HEDGING IS NOT THE SAFE DIRECTION when a human's risk decision reads your confidence

**#11617, 2026-08-04.** codex flagged the fixer's claim that a one-operand `DebugScope` reaches a
serialized `.slang-module` as *"not established anywhere above; the round-trip test has not been run"*
and told it to hedge to conditional. The fixer **refused, and was right.** It separated two conflated
things:

- *the test doesn't exist yet* — **true**, it is planned work;
- *the fact isn't established* — **false**, the manual `[__unsafeForceInlineEarly]` + `-dump-module`
  repro establishes it (`DebugScope(%3)` in the blob, re-verified before editing).

The real defect was **citing "as above" for evidence living in a *previous* comment**, unreachable to a
reader of this one. ⇒ **the repair is to make the evidence REACHABLE, not to weaken the claim.**

⭐⭐⭐ **And the consequence is the general rule: hedging a verified claim understates evidence you hold,
and when a maintainer's breaking-change / risk decision is calibrated on your confidence, that pushes
them toward LESS caution.** Over-hedging is normally the cheap safe move; on a risk assessment it fails
toward the unsafe side. Balances the "don't overstate" rules elsewhere in this store — which have no
counterweight for this direction.

⭐⭐ **Scope statement for codex-critique** (the fixer's, and the right *form* — a scope claim, not a
verdict): **reliably right about your OVER-claims, unreliable about whether a claim is SUPPORTED, because
it cannot see your prior artifacts.** ⇒ trust its must-fixes on what you *assert*; discount them on what
you *established elsewhere*, and repair those by citing the artifact, never by softening.
Sibling: codex "corrected" a self-correction claiming empty-stdout pipes when both commands had `2>&1`,
and withdrew — **check corrections in BOTH directions, especially ones confirming you were wrong.**

## ⛔⭐⭐⭐ THE WRONG ARTIFACT — a flawless measurement of the wrong object reads as a correct answer

**#11617, 2026-08-04.** Auditing *a PR's blast radius*, three tiers produced three cardinalities for
"files touching `kIROp_DebugScope`" — 12 (fixer), 11 (triager), 10 (mine). **The fixer's 12 was right;
the other two measured the tree WITHOUT the PR in it.** Verified with `?ref=<pr-sha>`:

```
slang-ir-inline.cpp   PR-sha: 1  (`case kIROp_DebugScope:` @:715)   master: 0   ← a line the PR ADDS
slang-ir.cpp          PR-sha: 2                                      master: 1   ← PR adds one here too
slang-ir-insts.lua    the op is spelled `DebugScope = {` @:2994 — NOT `kIROp_`
                      ⇒ invisible to a kIROp grep AND to search/code, though it DECLARES the opcode
```

⭐⭐⭐ **This is a distinct class from every other instrument defect: not a wrong tool, not a wrong
pattern — the wrong ARTIFACT.** Both wrong numbers were measured flawlessly, on an object that did not
contain the thing under review. **A flawless measurement of the wrong object is indistinguishable from a
correct answer** (slang-triager's framing). Pairs with *a checklist applied to the wrong object is
indistinguishable from no checklist* — same disease, covering the check and the measurement.

⛔⭐⭐⭐ **INSTRUMENT RULE, keyed to the command:** **anything measured about a PR must be measured AT THE
PR's SHA** — `gh api ".../contents/<path>?ref=<sha>"`, `git show <sha>:<path>`, or a worktree pinned to
that ref.
- ❌ **the ambient checkout is NOT a stable referent across turns** — slang-triager's working-tree HEAD
  moved `0864e60e6` → `5fc126c8f` mid-session with no action of its own, because a **sibling session
  refreshed the shared clone.** (The store already recorded that siblings rewrite memory files; the
  *checkout* moves too.)
- ❌ **`search/code` indexes the DEFAULT BRANCH** ⇒ structurally blind to any line a PR adds. My 10 had
  *three* independent scope failures: the branch-added inliner line, the branch-added `slang-ir.cpp`
  line, and the Lua declaration's different spelling.

⭐⭐ **And the survivor is the enumeration, again.** The fixer's **10-file consumer list** was verified
entry-by-entry and held throughout; only its cardinality was contested, and cardinality was decoration.
Three tiers × three instruments = three numbers; a fourth reader gets a fourth. ⇒ publish
*"these consumers, plus the Lua declaration files, plus the `as<IRDebugScope>` sites"* — **no count.**

⭐⭐⭐ **A CORRECTION ARRIVES WITH BORROWED CREDIBILITY FROM THE ACT OF CORRECTING, INDEPENDENT OF WHETHER
IT IS RIGHT** (the fixer's rule, and it caught two tiers). Strongest **down-tier**: a coworker receiving a
correction from above has the least standing to check it and the most reason to assume it was verified.

⛔⭐⭐⭐ **THE WORST FLAVOUR — a correction delivered as a CHARACTERIZATION of an artifact only the SENDER
can see** (slang-triager, 2026-08-04). Unfalsifiable from the receiving side **by construction**: the
recipient holds no copy, so there is nothing to open. That is precisely when a **verbatim quote is owed**
rather than a description. ⇒ **quote the sent text, don't describe it.**
Same move that produced the wrong-object count earlier — reasoning from an *account* of an artifact
instead of the artifact — and the cure is one-directional and cheap.

⭐⭐ **Credit arriving TOWARD you is the least-audited direction.** The fixer attributed a framing to the
triager that was actually mine; the triager caught it by **checking its own outbound**, not its memory.
You cannot notice unearned credit by re-reading your reasoning, and a store recording a lesson under the
wrong author is unfalsifiable from the inside for *both* parties — the real author has no reason to look,
and the credited party must check what it actually sent. ⇒ **verify provenance in the outbound, not in
memory.**
Here the triager sent a wrong correction downward **and I endorsed it** — two tiers' authority against the
coworker who was right, and the coworker won by running one command. ⇒ **a correction you send down-tier
needs the same control as a claim you publish up-tier.**

## ⛔⭐⭐⭐ THE EDIT THAT INSTALLS A RULE IS THE EDIT LEAST LIKELY TO HAVE THE RULE APPLIED TO IT

**Because writing the rule feels like discharging it.** Four attested instances, three tiers, one session
(2026-08-04) — every one committed *inside or immediately adjacent to* the artifact installing the rule:

| instance | the rule being installed | the violation, in the same breath |
|---|---|---|
| triager | *a correction isn't applied until every RESTATEMENT is fixed* | stale text below its new role table still named `kaizhangNV` as assignee, **one turn after filing it** |
| me | same positional rule, in the lesson that **hosts** it | my evidence-index row still said **"seven"** while the body said seventeen — a figure ten revisions stale, on the line a reader hits first |
| fixer | *don't publish capability-negatives* | wrote *"that's the only oracle that proves…"* **one sentence from its apology for a capability-negative** |
| me | *a read of a live artifact is a measurement with a timestamp* | filed an `updated_at` resolver **for that very defect** which cannot detect it (`updated_at` collides with any PR activity) |

⇒ ⭐⭐⭐ **Treat the rule-installing edit as the highest-risk edit in the session, not the safest.** The
feeling of having handled a class is generated by *writing about* it, and that feeling is what suppresses
the check. Concretely: **after installing a rule, run it against the artifact you just wrote** — sweep the
new file's own headings, frontmatter, index row, and adjacent prose for the defect it names.

⚠️ **This is the same disease as the OPEN PROBLEM below** (a trigger fires on an action, not on prose about
that action) — and it is the *tractable half*: the open problem has no clean remedy, but "re-run the new
rule on the edit that installed it" is mechanical and cheap.

✅ **First-use results, both tiers (2026-08-04) — the sweep works:**
- **Mine:** the `description:` frontmatter of *this file* covered 2 of its then-8 sections and named none
  of the four largest — stale in **the field a recall pass reads first to judge relevance**, on the memory
  that hosts the positional rule.
- **slang-triager's:** three defects on one file — **no `description:` frontmatter at all**, a header
  claiming "six rules", and an index row claiming "(8)", for a file holding **14**.

⛔⭐⭐⭐ **THE SWEEP'S DISPOSITION TABLE — three actions, not two** (slang-triager's final form; each of us
got one row wrong on first pass):

| finding | test | action |
|---|---|---|
| present-tense count | does a reader **act** on it? | **update** if yes |
| present-tense count | | **DELETE if no** — decoration is pure decay surface |
| historical claim (*"were …"*) | true **as written**? | **SCOPE, never rewrite** |

⭐⭐⭐ **The middle row is the one both tiers missed: a count that is correct today and load-bearing to
nobody is a LIABILITY, not a fact.** I dropped my stale "22" only after three incidents on that same
figure class; the triager **re-pinned "(14)" in three places while writing the rule about it**, then
deleted them. ⇒ prefer the **invariant** ("this child holds the complete set") which cannot rot, over any
tally which decays the instant it lands.

⛔⭐⭐ **REFINEMENT (slang-triager's, and it corrects my version): when the sweep finds a stale count, ask
whether the sentence describes the PRESENT or the PAST.** Its header's "six rules" sat in *"…were
inflating the index"* — a **historical** claim about the original lift, true as written. It **scoped** that
one (*"that count is historical; the file now holds 14"*) rather than rewriting it, while correcting the
index row's "(8)" outright because that was a live claim about present contents.
⇒ **Overwriting a true historical statement to make a number current destroys the record.** The same field
name can be either tense; only the present-tense one gets updated. ⭐⭐**That is not staleness — it is
RETROACTIVELY FALSIFYING A CORRECT STATEMENT, which no positional sweep flags because the text is not
wrong.** It belongs beside the sweep instructions precisely because **the sweep's instinct is to make every
number match.** Cf. [[feedback_correction_unapplied_until_every_restatement_fixed]] — the positional sweep
says *find every restatement*; this says *classify each hit's tense before editing it*.

## ⚠️ OPEN PROBLEM — a trigger fires on an ACTION, not on prose ABOUT that action

The fixer wrote *"that's the only oracle that proves…"* — a capability-negative — **inside the very
paragraph apologising for a capability-negative.** It was pattern-matching on the *topic* of the
correction while committing the error one sentence over.

⇒ The trigger fix below (key the rule to the action) is **necessary but not sufficient**: a trigger keyed
to an action does not fire while you are writing *about* that action. **No clean remedy identified** —
recorded as an open problem rather than papered over with a plausible one, since inventing a remedy here
would be the same error class the whole file documents.

⛔⭐⭐⭐ **SECOND POSITION OF THE SAME PROBLEM, mine, 2026-08-04:** a coworker reported *"my session is 0 of
202 rows in `ncl sessions list`"*. My store holds that fact **command-keyed, with the verbatim bound-test**
(`ncl sessions list` silently caps at **200**; raise `--limit` until the count stops growing — 2000→2002,
then 3000/5000/10000→**2152** = the real total). **It did not fire.** Not a retrieval-by-topic failure —
the row exists, keyed to the command, and my own index even says *key an instrument fact to the command
that summons it*.
⇒ **A command-keyed trigger fires when you RUN the command, not when you READ someone else's output from
it.** Reports about a tool are a blind spot the command-keying fix does not cover. (Consequence here: "0 of
202" could not establish absence for **two** independent reasons — `ncl` is group-scoped *and* 202 is a
page, not a population. Two callers landing on the same near-200 figure is the signature of a shared cap,
not of similar populations.)

## And the form of a rule matters more than its content

⭐⭐⭐ **A RULE HELD IS NOT A RULE FIRED.** The fixer hit the capability-negative trap from a memory it
wrote **earlier the same session**; the triager hit the identical one hours after we had both been
discussing it; I made two role-identity errors of the same family. Three tiers, rule in hand, none
fired. **That is not three discipline failures — it is evidence the FORM is wrong.**
⇒ **Key a rule to the ACTION that summons it, not to the topic.** Working shapes:
- *"Before writing 'X isn't there', name the scope you searched and run one command wider."*
- *"Before an @-mention, `gh api pulls/N --jq '.requested_reviewers,.assignees,.user.login'`."*
- ❌ *"Capability-negatives are self-sealing"* — true, and it never fires.
