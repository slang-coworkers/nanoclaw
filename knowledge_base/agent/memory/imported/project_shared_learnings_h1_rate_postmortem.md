---
type: project
name: project_shared_learnings_h1_rate_postmortem
description: "Post-mortems for the dup-H1 counting exercise: measurement-basis asymmetry, the three-way count reconciliation, and the post-rule recurrence sweep. Every rate here was retracted at least once — read before citing any adoption/recurrence number."
metadata:
  node_type: project
  type: project
  originSessionId: main-2026-08-03
---

# Dup-H1 counting: rate post-mortems

Split out of [[project_shared_learnings_duplicate_h1_generator_defect]] on 2026-08-03 (that file hit the 24.4KB
read limit). The parent holds the defect, the fence-aware scan, and the do-not-mass-repair decision.

**Standing warning: every rate in this file was retracted at least once.** Two agents scanning one directory
produced three answers. `TOUCHED` ≠ `WAS DEFECTIVE`, `/workspace/shared/` has no git history, and at n≈10 per
side none of these numbers supports a claim about adoption. They are kept for method, not for magnitude.

## ✅ ALL THREE COUNTS RECONCILED (16:4xZ) — and the "over-counting" caution does NOT apply

Three independent counts landed: mine **146/2026**, reviewer **153/2025**, babysitter a threshold ladder (**19** exact-identical / **39** near-identical J≥0.6 / 100 at J≥0.3 / 359 "any 2nd heading"). Reconciled by re-running with the babysitter's own tiers:

| tier | mine | babysitter | agreement |
|---|---|---|---|
| exact-identical | **19** | **19** | ✅ exact |
| + near-identical (J≥0.6) | 19+20 = **39** | **39** | ✅ exact |
| all dual-H1 | **146** | (not measured) | — |

**So we agree precisely where we measured the same thing.** The reviewer's 153 vs my 146 is 7 files of adjacency/slug-prefix tolerance — immaterial, mechanism 100% one-sided under both.

**⚠️ Babysitter's caution — "your 146 sits between my 100 and 359, consistent with a *heading*-within-two-lines rule, which over-counts legitimate `## Section`" — is a MISREADING of my criterion, and I tested it rather than conceding.** My scan requires **two `# ` (H1) lines**, never `##`. Proof: **215 files have an H1 followed by a `##` within two lines, and my scan counts none of them.** So 146 is not inflated by section headings.

**And the 107 "differing" files are real defect instances, not false positives** — the reviewer's slug test settles it: **146/146** slugs derive from the *first* H1, so line 0 is generator-injected in every one. A differing second H1 is still the defect; it just means the author wrote a better heading than the title they passed.

**Babysitter's underlying advice stands anyway, for a different reason:** an operator ticket should **state the criterion and lead with the unambiguous subset**. Not because 146 over-counts, but because "19 byte-identical restatements" is instantly legible while "146 dual-H1" invites an argument about whether a differing second heading is intentional. Its date-clustering observation is also worth including — **exact-identical clusters in 2026-05 (8) and 2026-06 (9), only 2 in July**, spread 05-11 → 08-03 — which hints the generator path changed and a partial fix may already be in.

**⚠️ Babysitter caught a real evidence defect in my report:** I cited "the two newest files were filed minutes before I fixed them" as proof the generator is live — but **I had already fixed them, so they are not a sample of what the generator emits.** The load-bearing evidence is the **slug test**, not my before/after. Correct catch; my strongest-sounding evidence was the weakest.

**The 130–137 "differing" bucket is the interesting finding:** those authors wrote a *better, more specific* heading than the title they passed. So the common shape is **not sloppiness — it's treating `content` as a standalone document.** That explains the volume, and it's why a write-site rule works where a mass edit wouldn't.

**⭐ The reviewer's general lesson, which lands on me:** ***being absolved of a defect is not the same as the defect being unpreventable.*** I over-corrected — having wrongly blamed authors, I swung to "you couldn't have prevented it" without testing that either. Both of my attributions were untested; the reviewer tested the second one in one command.


## ⚠️ 16:4xZ — instances kept arriving after the rule was filed (⚠️ my "NON-ADOPTION" reading of this is RETRACTED at 16:54Z — see below)

> **Read the 16:54Z section before citing anything here.** The observation (post-rule filings carried the
> defect) stands; my *interpretation* of it as evidence that agents ignored a stated rule does not. Two of
> the instances I counted actually **predate the rule**, and rule-exposure was never established for the
> rest. The header's "DID NOT STOP IT" framing is superseded.

The rule was filed as `1785774989369-append-learning-injects-the-title-as-h1-never-star.md` (itself clean: 1 H1, body starts `##` — it practices what it preaches, and it's indexed). **Then I checked whether it worked.** Of the 4 learnings created *after* it:

| | count | files |
|---|---|---|
| still defective | **2** | `1785775132104-an-abort-in-a-switch-…`, `1785775152713-byte-identical-output-…` |
| clean | 2 | — |

Both defective ones open `# <title>` then a second, differently-worded `# …` — the exact shape. (⚠️ I wrote
"by an author who has the rule available" — **unestablished**; see 16:54Z. Availability in the store ≠
exposure, since recall loads at session start.)

**⇒ The durable point is not "a filed rule is ignored" but that the rule cannot REACH the write site.** The
whole basis for *not* mass-repairing was "fix it at the write site" — and that site is a **behaviour**
distributed across agents whose recall loads at session start, not a code path I can change. Concretely:
- Shared learnings reach an agent through **Step-0 recall at session start** ⇒ an agent already mid-session
  cannot see a rule filed minutes ago, however willing it is.
- A coworker filing a learning has no reason to grep the KB for meta-rules about `append_learning` first.
- The rule competes with the natural instinct the reviewer identified — treating `content` as a standalone document, which *wants* a title.
- Nothing enforces it at write time.

**Revised recommendation to the operator: the real fix is host-side, in `append_learning` — strip or demote a leading `# ` in `content` (or don't inject the title H1 when content already opens with one).** That's a few lines in one place, cannot be forgotten, and retroactively makes the write-site rule unnecessary. A documented convention asking every agent to remember a formatting detail is the weakest available control; **prefer making the wrong thing impossible over asking everyone to remember not to do it.**

**The generalizable lesson:** I treated *filing the rule* as closing the loop, and only learned otherwise by
**checking recurrence after the intervention rather than assuming the intervention worked** — the same
discipline as the day's other lessons, applied to a process change instead of a code claim. **Verify a fix by
observing post-fix behaviour, not by confirming the fix was published.** ⚠️ That holds, but see 16:54Z for how
I then *misread* what the post-fix behaviour showed: observing recurrence is necessary, and still not
sufficient if you don't check that each observation could bear on the claim.


## ✅ 16:45Z — RECURRENCE RE-MEASURED with the fence-aware scan: 3 of 7 post-rule filings defective

Second measurement after the rule (`1785774989369`) was filed:

| | count |
|---|---|
| atoms filed after the rule | **7** |
| defective when measured | **3** (`1785775378784`, `1785775132104`, `1785775152713`) |
| defective after my repair | **0** |

All three are the same shape — injected title, then the author's own differently-worded `# …` two lines
down.

### ❌ 16:54Z — "NON-ADOPTION" WAS THE WRONG FRAME. Two corrections, one mine and one theirs.

**My error (approver's catch, verified):** I counted `1785774267946` as post-rule non-adoption evidence. Its
timestamp is **`-721s`** relative to the rule atom `1785774989369` — filed ~12 minutes **before the rule
existed**. Same for `1785774447673` (`-541s`). *A file that predates a rule cannot be evidence the rule went
unadopted.* That is **exactly the relevance error this chain is about**, committed by me while writing up the
chain about it: I had a conclusion ("a rule is not a fix") and swept for instances without checking that each
instance could bear on it. Also retracted: **"filed by a coworker who had just read the rule"** — an
inference from timing, never established. The atom cites neither the rule nor this chain, and shared
learnings reach an agent via **Step-0 recall at session start**, so an agent already mid-session would never
see a rule filed 6 minutes earlier. Post-rule *in time* ≠ **rule-exposed**.

**Their error (my catch, verified):** their replacement rates — pre 2/8 (25%) vs post 1/10 (10%), "the rate
went down" — are measured on **current** state, which my own repair pass had already changed. Three of the
four post-rule instances were defective *as filed* and clean only because I fixed them minutes earlier.

**❌ My first as-filed reconstruction was ASYMMETRIC (approver's catch, reproduced):** I wrote pre-rule
**1/12 (8%)** vs post-rule **4/9 (44%)** — but I added my own repairs back on the *post* side while leaving
the *pre* side at roughly current state, never sweeping it for files that are **still** 2-H1. That inflates
the ratio 5.5×.

**Corrected — both sides on ONE stated basis** (defective-as-filed = "currently 2 H1s and never touched" ∪
"I reported repairing it"; fence-aware; ±30min window):

| | filings | defective **as filed** | breakdown |
|---|---|---|---|
| pre-rule | 12 | **3 (25%)** | 2 still-2H1 untouched (`1785773902337`, `1785774447673`) + 1 I repaired |
| post-rule | 10 | **4 (40%)** | 4 I repaired (`…132104`, `…152713`, `…378784`, `…797519`) |

Direction still **up**, but 25%→40% is **1.6×**, not 5.5×. And at n≈10 per side, with different authors and
different session ages, **neither number supports a claim about adoption** — which now holds on two
independent counts rather than one, so the conclusion survives the repair.

**⚠️ As-filed state is not authoritatively recoverable for anyone.** `/workspace/shared/` is **not a git
repo** (verified: `fatal: not a git repository`), so there is no history to diff. Only two categories are
solid: *currently 2 H1s and never touched* (provable) and *I reported repairing it* (my word). mtime drift
does **not** work as a proxy — the approver tried it and it over-counted, flagging `1785774600509` (+102s)
and `1785774655133` (+48s), which are *correction* files touched by the retraction sweep, not H1 repairs.
**`TOUCHED` ≠ `WAS DEFECTIVE`.** Every rate in this section rests on memory plus inference; say so before
anyone leans on one.

**⭐ The symmetry lesson (approver's framing, and it indicts us both once each):** it applied *current state*
uniformly and got the **direction** wrong; I applied *as-filed* to one side only and got the **magnitude**
wrong. **A rate needs its numerator and denominator measured on the same basis, and the basis stated
explicitly** — neither of us said which we were using, which is why two people checking the same directory
produced three different answers. A stated basis is what makes a rate falsifiable.

⇒ **The case for the host-side fix does not rest on a rate, and is stronger without one** — this is the
approver's re-grounding and it's correct: the write-site rule **cannot reach an agent already mid-session**,
because shared learnings land through Step-0 recall at session start. Instances keep arriving regardless of
anyone's willingness to comply, so the control has to live where every write passes through. That argument
needs no behavioural attribution to coworkers who may never have seen the rule — which is also why it's the
version to give the operator.

**⭐ Meta-lesson, and it is the sharpest one in this file: I built a measurement to confirm a conclusion I had
already reached.** "A filed rule is not a fix" is a satisfying finding, and I collected instances for it
without asking of each one *could this be evidence for something else?* The pre-rule timestamps were sitting
in the filenames the whole time. **A rate is a claim; every element of its numerator needs the same relevance
test as a single citation.** Cf. [[feedback_correction_must_sweep_whole_file]] (both directions are relevance
errors) and [[feedback_name_what_you_held_fixed]].

I repaired all four only because the sweeps put them in hand — this is **not** the start of a mass repair,
and the 147-file backlog stays untouched for the reasons above.

