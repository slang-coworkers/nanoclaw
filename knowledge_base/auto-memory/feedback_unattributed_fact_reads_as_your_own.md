---
name: feedback_unattributed_fact_reads_as_your_own
description: "A fact sitting in your own notes reads as your own reasoning — 'it's in my notes' is not evidence you derived it. Never write reader-relative provenance (originSessionId: current); mark provenance-unknown LOUDLY, because uncertain attribution invites the verification that confident attribution suppresses."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# An unattributed fact reads as your own reasoning

## ⛔⭐⭐⭐ SEVENTH FORM — ATTRIBUTION ERRS IN **BOTH** DIRECTIONS; VERIFY A NUDGE EVEN WHEN IT IS CREDIT (2026-08-04)

Filed here, keyed to the **mechanism** (attribution/provenance), because I first wrote it inside a
compaction-incident file keyed to the *artifact I happened to hit it on* — and a future session with an
attribution problem would never search "the compaction bound targets the wrong file." ⭐⭐⭐**File a rule
by its MECHANISM, not by the artifact you first hit it on** — a peer independently flagged the same
defect in its own store the same day, so this is the recurring one.

**Both polarities, observed hours apart, same session:**

| direction | what happened | what caught it |
|---|---|---|
| **credit taken** that wasn't mine | a peer reported my standing fixer-drift directive as *sibling-authored*; the `originSessionId` said **`main-2026-08-03` — mine**. "A peer already knew it" was the comfortable read; "I knew it and lost it" was the true and more useful one. | reading the **owner field** instead of the wording |
| **credit given** that was mine | I credited a peer with the units/direction analysis; **it was mine**. The peer declined it, then *measured* my generalization and found half of it wrong (I had named `wc -c` as the hazard; the hazard is `wc -m`, which under-reports). | the peer refusing an unverified premise **even though it flattered them** |

⇒ ⭐⭐⭐**VERIFY A NUDGE'S PREMISES EVEN WHEN THE NUDGE IS CREDIT.** A mis-assigned finding is a provenance
error whose flattering direction points *away* from you, which is exactly why it draws no scrutiny — and
it leaves the real derivation **unowned**, so nobody re-checks it. ⭐⭐**Check the owner field in BOTH
directions:** before claiming a finding, and before handing one away.

⭐⭐**Why this is the same defect as the rest of the file, not a new one:** an unattributed fact reads as
your own reasoning; a *mis*attributed one reads as someone else's, and both bypass the check that asks
*how do I know this?* The remedy is identical — **the frontmatter owner field and the transcript, never
the wording.**

### ⛔⭐⭐⭐ EIGHTH FORM — OWNING A FILE DOES NOT MEAN YOU WROTE ITS CONTENTS (2026-08-04)

A peer went to retract a claim in a file **it owns** (`originSessionId` = its own session) and the edit
asserted-failed: **a sibling had already written the correction**, and written it better — including a
detail neither of us had (the trailing-newline confound). Hours earlier the same peer had checked this
direction, found its owned files contained only its own writing, and correctly labelled that **"a fact
about today, not a property."** It stopped being true within hours.

⇒ ⛔⭐⭐⭐**`originSessionId` gives you the OWNER, never the author of a given LINE. A sibling can write
into a file you own, and the result reads as YOUR OWN PRIOR CONCLUSION with nothing marking it.** That
is exactly the mechanism by which a sibling's fabricated figure steered my compaction decision — the
figure sat in a file whose owner I had no reason to distrust.

⚠️**The asymmetry that makes this the sharp end of the provenance problem:** this particular sibling edit
was **good**, so the cost was only a near-duplicate retraction. **A bad edit into a file you own is
indistinguishable from your own past reasoning**, and there is no line-level provenance anywhere to tell
them apart. **A clean audit of your own files is a snapshot, not a guarantee.**

### ⛔⭐⭐⭐ A SIXTH property: REACHABLE ≠ FINDABLE — the `description` field is a retrieval surface

A peer found the gap and it applies to every sweep I ran today: **transitive closure answers *can this be
opened*; it never asks *would anyone choose to open it*.** Per `system/definition.md`, `description` is
what a session scans to decide what to open — so **a missing or stale description is a retrieval defect of
the same class as a missing link**, and no reachability metric detects it.

Audited my store 2026-08-04: **27 of 513 files have no `description`**, of which only 1 was in a class
that matters (a sibling-owned `project_*` memo carrying a real `E39999` blocker — description added, body
untouched). But the **staleness** half hit my own key files, at the position read first:

| file | stale description | fix |
|---|---|---|
| the compaction case study | *"SIX mechanisms"* (reached seven) **and** *"the bound is UNVERIFIED IN BOTH DIRECTIONS"* (since settled at source) | lead with the **resolution** — ⚠️**but note the resolution I prescribed here was ITSELF later refuted**: "the nag targets a file the loader never reads" is FALSE (native auto-memory injects it). ⭐⭐⭐**A refuted claim quoted as an EXAMPLE OF GOOD PRACTICE reads as ENDORSED** — and only the INFERENCE axis finds it, since there is no stale figure or unit word to grep. The surviving advice is the SHAPE (lead with the resolution), never this instance's wording |
| the restored-chains index | *"23 memos"* (24 after I added `slangpy-samples#46`) | describe the **role**, mark the count indicative, say "re-run the sweep" |

⇒ ⭐⭐⭐**A description is the highest-position claim in a file, so it decays the most expensively: a reader
who trusts it never opens the body that contradicts it.** ⭐⭐**Fix it with the RESOLUTION, not a fresher
number** — "SEVEN" would have gone stale too; "RESOLVED, every mechanism dead" cannot. ⭐**When a file's
conclusion is superseded, the description is where the supersession must appear first.**

### ⛔⭐⭐⭐ "UNDONE" vs "DILUTED" — an identical TOTAL hid opposite mechanisms, and I inferred the wrong one

Closing out, my index had grown **+2,470 units with no edits by me**. Row count was unchanged at 36, so I
concluded *siblings expanded existing rows* — and reported that upward. **It was an inference from a
count, not a measurement.** A peer checked the specific rows *it* had collapsed (five of them, e.g.
1500 B→679 B) and found **all five still collapsed**, i.e. on its container curation is durable and merely
**outpaced**. Prompted by that, I checked my own collapsed row: **1,515 units, unchanged, marker intact —
my curation held too.** The growth had landed on a *different* row (2,281 → 2,674) that a sibling expanded.

⇒ ⭐⭐⭐**"MY WORK WAS UNDONE" AND "MY WORK WAS DILUTED" DEMAND OPPOSITE RESPONSES — the first says stop
curating, the second says keep going and expect a rate contest.** Had the peer adopted my reading it would
have abandoned curation on a mechanism that does not operate in its container; had I not checked, I would
have kept reporting one.

⭐⭐⭐**The tell, and why this was findable at all: the OUTCOME was identical on both sides (~2.5–3k
regrowth), so the TOTAL could never have distinguished the causes. Only "did MY OWN edit survive?" could.**
Same shape as two instruments that agree because neither can disagree in principle — **when a shared final
number is compatible with opposite mechanisms, measure the mechanism, not the number.** ⇒ **A per-row
survival check (did the specific edit I made persist?) is the discriminator; a size delta is not.**

⚠️**RESOLVED, and NOT per-container after all — both accounts converged.** I first framed reversal as a
per-container property (the peer's edits held, mine were "expanded"). Once I ran the per-row check, **my
collapse had held too** (1,515 units, unchanged) and the growth had simply landed on a *different* row a
sibling expanded. The peer then marked its own filed "per-container difference" as non-existent rather than
leave a tidy table reading as measured. ⇒ **The true, narrower claim: the INFLOW is continuous on both
containers; the REVERSAL happens on NEITHER.** ⭐⭐**Still measure it rather than assume — but do not carry
the per-container framing, which was an artifact of two agents each measuring only their own side.**
⭐⭐⭐**Two independent wrong readings converged on the same right answer only because each of us re-measured
after the other's report — the convergence was the check, not the agreement.**

### ⭐⭐⭐ The FIFTH question: "has someone already fixed this?"

Four pointer properties were established earlier (resolves / target has the facts / sweep covers every
link / the exact figure landed). Concurrent writers add a fifth, and it belongs **before** you write:

> **Grep the target for the correction's own keywords before writing the correction.**

The peer nearly published a duplicate retraction of a claim already retracted in its own file. I ran it
on my next two edits: one returned **5 hits** (a sibling had already documented the trailing-newline
confound ⇒ I added nothing), the other returned **0** with a passing non-zero control (⇒ genuinely mine
to write). ⭐⭐**One grep, and it decides between "necessary correction" and "churn."** ⭐**Run the
collapse-newlines ladder on that grep too — a line-wrapped phrase returns a false zero and would tell
you to duplicate work that already exists.**

Related: [[feedback_the_compaction_bound_targets_the_wrong_file]] (where the units instance occurred),
[[project_fixer_restart_tripwire]] (the directive instance).

## ⛔⭐⭐⭐ SIXTH FORM — THIS FILE WAS UNINDEXED, SO I RE-DERIVED IT FROM SCRATCH (2026-08-04)

**I wrote this file at 08:33 today** (owner `main-2026-08-03`, my own earlier session) and then spent a
later session re-deriving its core rule — that `originSessionId` exists, that "it's in my notes" is not
evidence of authorship — from first principles, at length, in dialogue with a peer.

**Cause: it had NO row in `MEMORY.md`.** `grep -c 'unattributed_fact_reads_as_your_own' MEMORY.md`
returned **0**. My own index banner names this exact failure — *"a dropped row makes its child
unreachable"* — and this file was never indexed in the first place.

⛔⭐⭐⭐**MY "53% DARK" FIGURE WAS WRONG AND I NEARLY ESCALATED IT — corrected here.** A peer challenged
the *metric*, not the finding, and was right:

| sweep | dark | note |
|---|---|---|
| one-level from `MEMORY.md` | **472/503 (94%)** | counts every rule bundled behind a 📁 pointer as unreachable |
| my published figure | 267/503 (53%) | one-level + `*index*` filenames — still one-level in effect |
| **transitive closure** | **150/503 (30%)** | follow links through children |
| **after indexing the real defect** | **143/504 (28%)** | **0 of 112 `feedback_*` rules dark; all 143 are `project_*` archives** |

⭐⭐⭐**A one-level reachability metric PUNISHES the bundled-pointer structure it should reward** — the
better an index bundles rules behind pointers (the compaction pattern adopted the same day), the worse it
scores. ⇒ **Compute reachability TRANSITIVELY and SEGMENT BY CLASS: a cold `project_*` archive being dark
is CORRECT; a dark RULE is the defect.**

⛔⭐⭐⭐**SECOND CORRECTION — "all 142 dark files are archives that SHOULD be cold" was ALSO WRONG, and I
asserted it from the FILENAME PREFIX.** A live-state sweep of the dark set found **36 carrying
`RESUME=`/`ACTIVE`/🔴 markers**, and checking each issue number against GitHub found **10 STILL OPEN
upstream** — including **#12124 (LIVE bug at HEAD)**, **#11963 (IN-FLIGHT)** and **#12032 (awaiting
maintainer apply)**. Dark memos for live chains: exactly the #11616-went-dark-7-weeks failure my own index
banner warns about, in the class I had dismissed. Now indexed behind one pointer in
[[slang-longtail-chains-index]]; dark set 142→132, **0 of 113 rules dark**.

⭐⭐⭐**`project_*` IS A FILENAME, NOT A LIFECYCLE STATE — and a `RESUME=` marker inside the file is still
only WORDING. Liveness is a claim about UPSTREAM STATE ⇒ query the upstream.** This is the fifth
wording-vs-meaning instance of the day and the first that *dismissed* real work rather than manufacturing
it: prefix→"cold" is the comfortable reading, and it silently retired 10 live chains. ⚠️**A peer ran the
identical sweep on its own store, got 2 hits, and both WERE false alarms (historical section titles).
Same method, opposite result, per container — which is why measuring beat adopting, in both directions.**

**The real defect was 7 files, not 267** — seven live *operational* rules (supervisor-nudge behavior,
respawn amnesia, self-mod approval routing, session-existence probes, operator-DM attribution) each owned
by a *different* session, so nobody indexed them. Now linked from
[[slang-routing-lessons-index]] with a cross-session-append banner. ⭐⭐**An unindexed lesson is still not
memory — but "the store is 53% dark" was an overstatement of a bounded, fixable gap, produced by the
wrong instrument.** Same lesson as everything else today: the metric was the defect.

⇒ **Two rules, both cheap:**
1. **SEARCH BEFORE DERIVING** — `grep -ril '<distinctive fragment>'` over the memory dir *before*
   writing a new lesson. Deriving feels like rigor; here it was an unrun search.
2. **INDEX A LESSON THE MOMENT YOU WRITE IT.** Writing without indexing manufactures a dark file, and
   the cost lands on a future session that cannot know to look.

⭐⭐**Also a near-miss on attribution, in the comfortable direction:** a peer reported this file as
*sibling*-authored and I nearly relayed that. The owner field says `main-2026-08-03` — **mine**.
"A peer already knew it" is the flattering conclusion; "I knew it and lost it" is the true and more
useful one. **Check the owner field before assigning a finding to anyone, including away from yourself.**

## ⭐⭐ FIFTH FORM — CREDITING A PEER FOR A DEFECT THE **HARNESS** SHOWED ME IN MY OWN FILE (2026-08-03)

The mirror of the fourth form (declining credit you didn't earn): here I **assigned** a finding to a
peer that was actually mine, and in doing so I put a false claim about *them* on the record.

**Receipt.** I wrote: *"The triager's message contained the drift it was describing — it **quoted** my
index line saying 7 mechanisms."* It did not. The stale `7` reached me in a **`system-reminder`
diff of my own `MEMORY.md`**, attached by the harness to that turn. The triager's prose discussed only
its own store (`hook 8 / child 8`). It then corrected me, and was right: it had fixed its own digit the
turn before, so the `7` was never in what it sent.

**Why this is worth its own form.** The three sources in a turn — (a) my own files, (b) a peer's
message, (c) harness-injected reminders — arrive in **one** context window and read alike. Attributing
(c) to (b) is easy and it fails in the most damaging direction: it **credits a peer with catching my
defect**, which sounds generous, so nothing prompts a check. The peer then has to spend a turn
defending a state that was already correct. That is worse than silence: I made them audit a
non-existent error of theirs.

⇒ **Before writing "X found/quoted/said …", grep X's actual message text for the string.** A
`system-reminder` is not the peer speaking; it is the harness showing me myself. If the string only
appears in a diff of my own file, the finding is **mine** — say so plainly, including that the harness
surfaced it rather than my own audit.

⭐ **And: a peer pushing back on attribution deserves the same verification as one pushing back on
substance.** My instinct was to concede (conceding looks humble). Conceding without checking would
have had me "re-fix" a number that was already right — the exact failure this file's fourth form
warns about, inverted. I checked; the triager was correct and I was wrong.

⭐⭐ **STATE IT AS THE SYMMETRIC PAIR** (triager's framing, sharper than my first cut — my version had
the verification duty but never named the blame half):

> **Don't accept credit you didn't earn — and don't accept blame you didn't earn either,
> when a one-second grep settles it.**

Both directions corrupt the record identically, and both are *socially* easy to get wrong: accepting
credit is tempting, and accepting blame **reads as humility**, so neither invites a check. The
asymmetry is only in which one feels virtuous. Same instrument settles both: grep the actual
artifact — their message text, my own file — before writing the attribution either way.

## ⭐ THIRD FORM — RELAYING A COWORKER'S NUMBER UPWARD LAUNDERS IT INTO A FACT (2026-08-03)

The other two forms are about *credit*. This one is about **escalation**, and it is the costliest: a number that arrives from a coworker and leaves in **my** operator escalation loses its provenance in transit. The operator reads it as Main-verified, because I am the one saying it.

**Receipt.** slang-ci-babysitter reported REST rate-limit exhaustion, `Used: 6000/6000`. I put "it's now causing secondary REST rate-limit exhaustion (a babysitter sweep hit 6000/6000)" into an operator escalation **and** into my own memory — **without probing my own token once.** slang-triager then challenged it from its own edge (its REST reads worked fine) and hypothesized the number was a misread OneCLI error body.

**Both of us were partly wrong, and only a probe could tell.** I ran it: my own `X-Ratelimit-Limit` is **exactly 6000** and the OneCLI error body carries **zero numeric fields** — so the babysitter's number was a *genuine GitHub header* (triager's hypothesis **refuted**), while the exhaustion was a **transient window, not a standing condition** (my "is now causing" framing **overstated** it as ongoing).

**Three lessons, in order of how much they cost:**
1. ⭐**Probe before you escalate a coworker's number.** One `gh api -i` would have produced the correct, hedged escalation on the first pass. Operator-facing claims are exactly where relay-as-fact does the most damage — a human may act on it.
2. ⭐**A challenge to a relayed fact is not a reason to adopt the challenge.** The triager's correction was well-reasoned and arrived with a table of probes; adopting it would have been *more* wrong than what I wrote, because it would have discarded a real signal. **Refuting the challenger is as much my job as refuting myself** — see [[feedback_correction_must_sweep_whole_file]] (over-correcting reads as honesty) and [[feedback_mechanism_must_predict_observed_coordinates]] (an over-stated REFUTATION is worse than an over-stated mechanism).
3. **Tense carries a claim.** "Is now causing" asserts an ongoing state that "hit, in a transient window" does not. A relayed measurement is a **point observation**; re-deriving its *current* truth is a separate act from confirming it *was* true.

**How to apply:** when a coworker hands you a number that would change what an operator does — run the equivalent probe on your own edge first; report it as `<coworker>-measured, mine-verified` or `<coworker>-measured, unverified`; and state the observation window, not a standing condition. Never let a relayed figure appear in an escalation in your own unqualified voice.

---

**Live receipt, 2026-08-03.** slang-triager credited me with a `git rev-parse HEAD == head -1 .git/shallow` discriminator for detecting shallow-clone corruption. **It was not mine.** It entered my `MEMORY.md` via a **concurrent compaction by another session** while I was mid-edit; I appended adjacent text around it and reported the entry as "improved." When the credit came back I had no basis to accept it, and declined.

**"It's in my notes" is not evidence I derived it.** In a workspace where several sessions write one index, a fact's presence in my record says nothing about its origin.

## The machine-readable amplifier: never write reader-relative provenance

Auditing my own tree after the above: **6 files carried `originSessionId: current`** — a *reader-relative* placeholder that resolves to **whoever is reading**. That doesn't merely fail to attribute; it **actively asserts the reader as author**. Two classes were present:

- `feedback_*` rules I would have described as mine (`actions_job_logs_are_public_follow_redirect`, `parse_whole_failure_set_before_characterizing`, `matching_incumbent_path_is_not_validation`, `read_the_input_contract_not_more_output`, `recorded_is_unfalsifiable_across_tiers`)
- a project file (`project_slang_rhi_807_disable_metallib_4_0`)

All 6 rewritten to **`unknown-prior-session`**. Rationale: an absent or explicitly-unknown field **reads as unknown, which is true**; `current` **reads as mine, which was false**. I read each file before editing rather than blind-patching records I may not have written.

Scope check on my tree: 413 files, 412 carry `originSessionId`; the only one without is `MEMORY.md` — an aggregate, multi-session **by design**. slang-triager found the identical defect independently (3 files of 134, same `current` value, two of which they had never written).

### ❌ MY INFERENCE FROM THAT WAS WRONG — it is **NOT** a tooling/template artifact

I concluded "same defect in two independent trees ⇒ common upstream cause" and proposed escalating to whoever owns the memory-write path. **Triager traced it; there is no upstream emitter.** Their evidence + my independent confirmation:

- **No hook/config/template anywhere emits `originSessionId`.** Every hit outside memory files is unrelated: `nanoclaw-kb/src` uses the name for **task scheduling + a2a routing** (`originSessionId?: string | null`, assigned real ids or `null` — grep for it paired with `current` returns **nothing**), plus session transcripts (which merely *record* the writes).
- **Across 62 session transcripts, 59 wrote a real session uuid; only 3 contain `current`** — and parsing the `Write` calls, the literal sits **inside agent-authored `content`**: session `060e858e` typed it into two files, `98a8d0bf` into one.
- A **second, separate** memory tree (`nanoclaw-kb/knowledge_base/auto-memory/`) has **zero** instances.

⇒ **Agents filling in a field they had no value for, then later sessions inheriting it by copying a neighbouring file's frontmatter as a template.** A shared bad *habit*, propagated by copy — not shared bad tooling. **So there is no upstream owner to escalate to, and file-level repair IS sufficient**, provided the never-write-reader-relative rule holds at write time.

⚠️ **The inference error is this thread's pattern one more time: the SAMENESS of a defect across two independent trees is NOT evidence of a common cause.** Two agents can converge on the same wrong value from the same wrong instinct. I would have filed an escalation that went nowhere, and closed the item as "not mine to fix" — which is the expensive half of the mistake. **Before attributing a shared defect to shared tooling, look for the emitter.**

**Aggregate files are where provenance dies.** Indexes, backlogs, terminal logs — anything many sessions append to — carry no per-entry origin. That is exactly where a foreign fact acquires the appearance of yours.

## Mark provenance-unknown LOUDLY — it is protective, not embarrassing

The strongest evidence for this, from the same exchange: **the reason the triager found a real defect is that I had flagged I could not verify the discriminator.** Treating it as *relayed* prompted them to test it against the real clone — which is how the `DEPTH-1 ONLY` scope turned out to be wrong (mode 2 fires on the **graft root at any depth**; a depth-203 clone reading "not depth-1, so I'm safe" gets false safety). Had I reported it as my own derivation, they would likely have accepted it, and nothing in the entry would have prompted a check.

⇒ **An unattributed fact invites verification; a confidently-attributed one suppresses it.** Smoothing over uncertain provenance doesn't just misattribute — it disables the audit that would have caught the error underneath.

## Rules

1. **Never write reader-relative provenance.** No `current`, `self`, `me`, `this`, `now`. Use a concrete session id, or an explicit `unknown-prior-session`.
2. **Decline credit you cannot source.** Being handed credit for a fact you can't trace is a signal to audit, not to accept.
3. **When you can only verify half a mechanism, say which half.** Verify the side your environment can reach and *attribute* the rest — don't co-sign it. (I own API-side truth, holding no `slang-rhi` clone; the triager owns local-clone behaviour there. Route accordingly.)
4. **Audit aggregates specifically.** They are per-design multi-writer, so they are where foreign facts land unmarked.
5. **Sameness of a defect across independent trees is NOT evidence of a common cause.** Before attributing a shared defect to shared tooling, **look for the emitter** — two agents converge on the same wrong value from the same wrong instinct all the time. Getting this wrong costs twice: a wasted escalation, plus closing the item as "not mine to fix."
6. **A compaction that improves an entry while dropping a detail defeats diff-by-eyeball** — pure loss is easy to spot; loss-plus-improvement reads *better* afterward. Write durable content to the topic file first, touch the index last.

Related: [[project_11225_capability_target_incompat_slangpy_break]] (a wrong premise supporting a right conclusion is the version that survives review) · [[feedback_shallow_clone_makes_your_head_the_graft_root]] (the discriminator in question, now scope-corrected) · [[feedback_never_relay_a_verdict_not_in_hand]] · [[feedback_recorded_is_unfalsifiable_across_tiers]].

## ⭐⭐ SIXTH FORM — a peer HANDS you a better formulation; record the handoff in the SAME edit

The fifth form was crediting a peer for what the harness showed me. This is its complement: **a peer
gives me a sharper sentence, I store the sentence and omit the name**, and in my own file it now reads
as my reasoning.

**Receipt (2026-08-03, #12331).** slang-triager formulated *"a verification procedure is the most likely
place to ship the defect it documents, because writing the rule feels like having applied it."* I stored
it verbatim in [[feedback_narrowing_is_not_testing_check_own_store]] — crediting its *defect instance*
but not its *wording*. Caught only because it then credited **me** with the formulation, which made me
ask *whose is it?* **We were each about to mis-credit the other in opposite directions.**

⇒ **Record the handoff in the same edit that records the sentence.** A week later the file is the only
witness, and **an unattributed line defaults to whoever holds the file.** Split it explicitly when the
work is joint: *facts joint (one confirming instance per store) · wording theirs.*

⭐ Note the shape: this is the **third** attribution error in one session, each in a different
direction — relaying a peer's number upward as fact (3rd form), crediting a peer for a harness finding
(5th form), and absorbing a peer's wording by omission (6th, here). ⇒ **Attribution fails in more
directions than "don't take credit"**; the only mechanical guard is to name the source *at write time*,
never at review time.

## ✅⭐⭐ THE CONSTRUCTIVE INVERSE — a DECLARED dependency (slang-triager, 2026-08-04)

The whole file above is about credit/provenance going *missing*. Here is the practice that fixes it,
demonstrated by a peer rather than by me, worth copying verbatim:

> *"Confirming your GitHub check independently matters, so I note I did not re-run it — you read
> `5176095755` directly and ran a six-term absence ladder. I'm accepting that on your evidence rather
> than duplicating it, and flagging that I'm doing so: my belief that the public comment never instructed
> filing rests on **your** read, not mine. If that becomes load-bearing for a decision, I'll verify it
> myself before acting."*

⭐⭐ **Three things this does that a silent accept does not:** (1) it prevents the fact from laundering into
their own store as independently verified; (2) it names the **condition for upgrading** it — *if it becomes
load-bearing, verify first* — so the dependency has an expiry rather than hardening into a shared premise;
(3) it keeps the count of independent sources honest at **one**, which is what stops the
[[project_approver_pipeline_defects_devin_fetch_ci_green]] failure — ⭐⭐⭐**agreement isn't corroboration
when the peer's source is ME.**

⇒ **Adopt it in both directions.** Declining to duplicate a peer's check is usually correct (it is cheap
and non-load-bearing); **silently absorbing it is not.** State: *what I did not run · whose evidence I am
standing on · what would make me run it myself.* This is the honest form of the shortcut, and it is the
mirror image of the defect this file documents — there, unattributed credit inflated my contribution; here,
an undeclared dependency would have inflated the *evidence base*. Same root: the reader cannot see whose
measurement is underneath.

## ⛔⭐⭐⭐ THE DOMINANT FAILURE MODE IS NON-RETRIEVAL, NOT NON-KNOWLEDGE — three distinct shapes (08-04, slang#12344, Main + approver)

`SEARCH BEFORE DERIVING` (above) says grep before writing a *lesson*. **Insufficient: I skipped the search
before running a *command*, which is where the cost landed.** One chain produced **three** instances of
knowledge present and not applied, none caught by any existing rule:

| # | shape | instance | why nothing fired |
|---|---|---|---|
| 1 | **fact in context, not retrieved at point of use** (mine) | `MEMORY.md` line 7 carries an "INSTRUMENT LIFEBOAT" row saying `--agent-group` is inert. **It is injected at session start.** I ran the broken flag anyway and reported the defect to a peer as my own discovery. | Proximity in the prompt ≠ retrieval when acting. Nothing asks "did you read your own index?" |
| 2 | **pointer with a met trigger, never fetched** (peer's) | Its index says *"PROCESS FILE `[P]` — READ IT before any decision artifact."* `[P]` holds the same flag fact in 4 places. It produced review doc + clauses + ledger row **without opening `[P]` once.** | ⭐⭐⭐**A pointer with a trigger is not a fact — it is a PROMISE TO FETCH one, and nothing checks the fetch happened.** An unread pointer emits no error, just a session proceeding as if the rules didn't exist. |
| 3 | **framework held, not run** (peer's) | Its own three-tier severity test, written hours earlier on #12246, arguing tier (a) against today's abstain — never applied to #12344. | A framework in a file competes with reasoning in context, and context wins. |

⇒ ⭐⭐⭐**All three fail at the same moment — the moment of action — and NONE fails loudly.** That is why they
survived a chain in which two tiers corrected each other's instruments ~15 times: **every correction was on
EVIDENCE, none on RETRIEVAL.** Adversarial rigor on inputs does not touch this class. ⚠️**Do not compress
this into "the corrections didn't matter": the MEASUREMENT corrections were inert to the verdict, but the
STATE corrections changed which SHA was judged and what the findings were**
([[feedback_two_tiers_one_frame_is_shared_prior]] §split). Neither kind reached the retrieval class; only
one kind was inert to the outcome.

✅**The fix, the peer's phrasing of my finding: KEY AN INSTRUMENT FACT TO THE COMMAND THAT SUMMONS IT, NOT
THE INCIDENT THAT PRODUCED IT.** Put it where the hand reaches — the note you open to ask the question, not
the file about the day it broke. Applied: the `--agent-group-id` correction now lives in
[[feedback_thread_id_filter_for_session_existence]] (the "does a session exist for this thread?" note), not
only in the flag-defect file that already had it.

⛔⭐⭐⭐**What NOT to do — the peer declined the obvious move and was right:** it did **not** add an index line
telling itself to read the index's pointer. **The rule already existed and was explicit; the gap was
compliance, not documentation, and another injunction is just a second thing to skip.** ⇒ **When a rule was
present and unfollowed, restating it more loudly is the NULL FIX.** Move the fact, or accept the gap and say
so. Cf. **the fix for a thin rule is often to downgrade its FORM, not strengthen its claim.**

⭐⭐**And the reusable half of the peer's hardcoded-label error: A DOCUMENTED SYMPTOM WITHOUT THE ACTIONABLE
DETAIL IS A NOTE THAT CANNOT PREVENT ITS OWN INCIDENT.** Its file recorded *"the flag is silently ignored"*
and never that `--agent-group` is the wrong spelling — so the note was true, on-topic, and unable to stop
the recurrence it described.

⭐⭐⭐**Corollary on peer confirmation: the peer's `cli_scope=group` edge is STRUCTURALLY BLIND to this
defect** — its scope pre-narrows server-side, so broken-flag and correct-flag results are indistinguishable
from where it stands. It said plainly it would have "confirmed the broken flag works, with a clean-looking
result." ⇒ **A peer confirming your tool invocation is worthless when their environment cannot express the
failure — ask what their scope/mount/permissions make INVISIBLE before counting their agreement.** General
control: **filtered-vs-unfiltered counts cannot prove a filter filters** (they agree whenever scope already
narrows); **pass a NONEXISTENT value and require zero** — `ag-0000000000000-zzzzzz` → 0, `NOT-AN-ID` → 0,
real id → 187, unfiltered → 2150.

## ⭐⭐⭐ 08-05 — EXTENSION: search for the RULE you are about to contradict, not just the FACT you are about to record

> ⚠️ **EVIDENCE-BASE BANNER — this section only** (`SEARCH BEFORE DERIVING` above is separately evidenced).
> **ONE chain: slang#12345, 2026-08-04/05.** Re-derive it FIRST when it next fires; ⭐⭐⭐ marks severity,
> **never frequency.** ✅**The mechanical half is what to trust** — *run a second grep, targeting the rule
> you might contradict rather than the fact you might duplicate* — because its mechanism is readable in the
> command itself and it costs seconds. The interpretive half (*a rule you cannot see is a rule you will
> contradict*) is strong on mechanism, n=1 on frequency.

`SEARCH BEFORE DERIVING` (above) protects against writing a duplicate. It does **not** protect against
writing a **contradiction** — and that failure is worse, because a duplicate is redundant while two
opposing rules in one store make the reader pick, usually by whichever they hit first.

**08-05, slang#12345 close-out, caught by `slang-pr-approver` before either of us wrote it.** The chain's
finding was *"a peer measuring an artifact I cannot reach adds an instrument — ~14 corrections, zero
shipped defects."* **Both of us independently held
[[feedback_two_tiers_one_frame_is_shared_prior]]** (from #12344: peer agreement on a disposition is shared
prior, measured nothing across ~15 rounds). Unbounded, that rule contradicts the new finding.

The peer grepped for the contradiction *before* writing and caught it. I then verified the boundary was
genuinely absent from my copy — `cannot reach` → 0, `same artifact` → 0, `adds an instrument` → 0, with the
lone `artifact` hit carrying **the word, not the rule** (it was about dating a change vs its container). So
it went in as a **boundary section on the existing rule**, not as a competing maxim:
**agreement over the SAME artifact adds nothing; measuring an artifact I CANNOT REACH adds an instrument.**

⇒ ⭐⭐⭐**Before recording a finding, grep for the rule it might contradict — not only for the fact it might
duplicate.** Two different searches with two different targets; `SEARCH BEFORE DERIVING` only runs the
first. ⇒ ⭐⭐**When you find one, prefer a BOUNDARY on the existing rule over a new competing rule** — it
puts the limit where the reader already lands.
⚠️**The peer's own caveat is the load-bearing part: it only caught this because the rule was in its INDEX,
visible. Had it lived in an unopened child, the contradiction would have shipped.** ⇒ **a rule you cannot
see is a rule you will contradict** — which is the reachability problem (born-dark rows) and the
contradiction problem turning out to be one problem.
⭐⭐**Related instrument note from the same close-out: a reachability probe that checks DIRECT linkage reads
"0 parents in the prefix ⇒ dark" and is wrong** — my extended file had zero direct parents yet was
reachable at **depth 2** via an intermediate child that was itself in the prefix (verified hop-by-hop with
link syntax, not substring presence). Stopping at the shallow answer would have added a redundant lifeboat
and reported a defect that did not exist. **Walk the closure; verify each hop by link syntax.** Third
instance in that chain of a check running one level shallower than the question it answered.
