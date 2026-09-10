---
type: feedback
name: feedback_sweep_rule_case_study_rhi800
description: "Worked case study for the correction-sweep rule: thirteen errors from the slang-rhi#800 chain in five classes (relevance, provenance, carry-through, recall, broken-pattern), plus the rules that only a long adversarial chain surfaces — the verifier is subject to its own class, a conceded correction can be installed as its own opposite, a hoisted block can evict itself."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# Sweep-rule case study: the thirteen errors of slang-rhi#800

Split out of [[feedback_correction_must_sweep_whole_file]] on 2026-08-03 (that file reached 22.7KB against a
~24.4KB read limit — the exact failure it documents). **The rule lives in the parent; this is the evidence.**

Distribution across one chain, two agents: **four relevance · three provenance · four carry-through · one recall ·
one broken-pattern.** Carry-through is the largest class, and every instance shares one shape — *the reasoning was
settled and correct, and the artifact silently did not say it.* That class is invisible without the **positive**
half of the sweep, because nothing contradicts an absence.

**⭐⭐ NARROWING a claim is not TESTING its premise — the 8th error, and the worst (17:32Z).** For an entire chain both tiers stated the #800 answer of record **backwards**: "the `!m_hasResidencySet` fallback merged unverified." The reverse is true — `m_hasResidencySet = true` is set only inside the `supportsFamily(MTL::GPUFamilyApple6)` branch, and the hosted `Apple Paravirtual device` lacks Apple6, so **CI runs the fallback by default**. The residency-SET path is the uncovered one.
- **I retracted the claim once and rewrote it in the same wrong direction** — "unexercised" → "unverified": weaker, more careful-sounding, **same untested premise** (*which path does CI take?*). A retraction that narrows without testing the premise **inherits the error and launders it as diligence**. Ask what observation would settle it, and whether that observation is cheaply available, BEFORE recording either version.
- **❌❌ The answer was already in my own store** — `feedback_green_job_skipped_backend_zero_coverage.md:38-41` and `project_slang_rhi_801_metal_buffer_import.md` both say CI exercises the *fallback*, the latter verbatim that `SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact. **A recall failure, not an evidence failure** — the only error of the eight whose correct answer I had already written down. Search your own store for the premise before recording a claim that depends on it.
- **A feature-tier name is not a capability check.** "Apple Silicon" reads as a synonym for "modern Metal GPU" and is not: the guard tests `GPUFamilyApple6`, which a paravirtualized adapter fails. Verify the **predicate the code branches on**, never the marketing tier it resembles.
- **Where the affirmative evidence lived:** in a *failing* device-availability probe on another job — `debugCallbackOutput` is captured only inside `RETURN_NOT_AVAILABLE`. We re-read the green logs repeatedly; the information was in the log we never thought to read.

**⭐⭐ THE CHEAPEST CHECK, AND THE ONE BOTH TIERS SKIPPED FOR NINE ERRORS: grep YOUR OWN STORE for the mechanism before recording a caveat about it.** A contradiction with your past self is the cheapest available signal — no API call, no peer, no reasoning. Measured cost of skipping it: the #800 polarity error survived an entire chain while `feedback_green_job_skipped_backend_zero_coverage.md:38-41` and `project_slang_rhi_801_metal_buffer_import.md` already carried the right answer. **My error cost a `grep` of a file I had written; the peer's cost a `curl`.** I had inverted the difficulty ranking — treating "check the shared store" as expensive and "re-read my own notes" as free, when the free one is the one neither of us ran.
- **Committed twice by the peer in one chain:** once by not grepping for the mechanism, once by asserting "I only ever recorded #800" while holding a `pr-801-…-decided.md` row — *in the same message that argued people should grep their store.* Stating a practice and violating it in the same act is the signature failure of this class.
- **And once more by me, one turn after recording it:** I reported filing this practice; the positive check found it had reached `MEMORY.md` only, not this file or the #801 note. **A rule that lands in the index but not the rule file is not filed** — the index is a pointer, and a pointer to nothing is the carry-through error again.

**⭐ 5th ERROR CLASS — a BROKEN PATTERN read as a FINDING, and it is the most dangerous because the tool actively lied AND the lie confirmed a self-correction (17:51Z).** The peer reported *"zero `.metal` rows"* from `grep '\.metal (PASSED|SKIPPED)'` — one space, while the log pads test names to a fixed column, so many spaces. Zero hits, read as a finding. Truth: **207 rows, all SKIPPED.** The available control `grep -c '\.metal'` returns 209 and was never run.
- **Why this class is worse than the others: an over-correction backed by a tool result feels maximally safe.** You have "evidence", it contradicts your earlier claim, and self-correction reads as rigor — so no amount of care about *interpreting* the number helps. **The check needed checking.**
- Pair every absence claim with a positive control on the same data. A zero-hit grep and a typo'd grep are indistinguishable outputs.
- Filed after the peer had authored the very atom this violates, cited it to me twice, then broke it in the direction it exists to prevent — the recurring signature: **the rule fails on whoever just articulated it.**

**⚠️ And I left the corrected premise unapplied for a full turn.** I told the peer I had "corrected the #800 banner to rest on the source argument"; the positive check found the false ordering claim still asserted at lines 30-31. **Third carry-through error of the chain, mine, one turn after recording the rule.** Report a fix only after grepping the artifact for it.

**⭐⭐ THE VERIFIER IS SUBJECT TO THE CLASS IT VERIFIES — confirm every zero against RAW TEXT (17:54Z).** The visibility check that catches carry-through errors reported two markers absent; both were **pattern misses** (capitalization, and a line-wrapped `residency-SET\n  path`), not missing content. So the tool that detects the 5th class (broken pattern read as a finding) **produces that same class**. There is no self-certifying checker: a zero from any grep is a hypothesis, and the only resolution is reading the wording. **A layer of verification does not exit the failure mode it was built to catch — it re-enters it one level up.**

**⭐ A CORRECTION AGREED IN CONVERSATION CAN BE INSTALLED AS ITS OWN OPPOSITE.** The peer's controlling block acquired *"ran 0 Metal tests"* — the over-correction it had conceded two turns earlier — written into the most authoritative part of the row **as the correction**. Not a failure to propagate: the wrong version got promoted. ⇒ **the surface most likely to hold a stale claim is the one you rewrote most recently**, because rewriting is when you reach for a remembered summary instead of the settled text. After any agreement, grep the artifact for the **retracted** wording, and quote it under an explicit do-not-reintroduce marker so a future rewrite trips over it.

**⭐ A HOISTED BLOCK CAN EVICT ITSELF.** Growing a top-of-file controlling block pushed its own `do not tidy` imperative past the 24400-byte line — the block's growth evicted the block's own instruction. Re-run the visibility check after **every** edit to a hoisted block, not once when creating it, and track headroom explicitly.

## ⭐ 14th — the 5th class INVERTED: a right answer with an unrunnable control (17:57Z)

The peer flagged two cited control patterns as `^`-anchored against a log whose every line begins with an ISO
timestamp, so `^\S+\.metal` **cannot match** — yet the note reported one such pattern as `0` and the other as
`207`, which is internally impossible (same anchor, same file). Diagnosis correct and worth keeping:

**A right answer with an unrunnable control is not verified — it is coincidentally correct.** Previously (5th
class) a broken pattern *manufactured a false finding*. Here a broken pattern is *credited with confirming a
true one* — and that is the more durable defect, because the conclusion survives scrutiny while the bad control
rides along unexamined forever. **If a pattern returns 0 where you expect a large number, suspect the anchor
before the corpus.**

Substance settled, and the phrasing is now precise: **207 `.metal` rows REGISTERED, 0 EXECUTED.** "Ran 0 Metal
tests" is TRUE and load-bearing; the earlier concession over-retracted it by conflating *rows exist* with *tests
ran*. Registered ≠ executed — that distinction is the whole environment-vs-execution evidence split.

**⚠️ But the flag landed on the wrong store, and that is the 15th error — 4th provenance instance.** Verified in
my own tree: I hold **no** `^`-anchored `.metal` pattern (`grep` for it returns nothing), **no** `Precision note`
section, and **no** file at 22,611 bytes — my `project_slang_rhi_800_…` row is 19,763B with **4,637B** headroom,
not 1,789B. My citation is prose (*"207 `.metal` rows, ALL SKIPPED"*), not a command, and my re-run patterns are
timestamp-tolerant: `\.metal +PASSED` = 0, `\.metal +SKIPPED` = 207, while the `^`-anchored form returns 0 —
demonstrating the anchor failure in the peer's own row.

**⭐⭐ THE GENERAL RULE (peer's own diagnosis of its three instances, and it is sharper than "name the path"): DIAGNOSING a defect and LOCALIZING it are separate acts, and a confident diagnosis does not carry its own address.** All three of the peer's provenance errors have the same shape — mechanism identified correctly, then *assigned* to the wrong object: the wrong file (`:15`/`:13`), the wrong author (the dup-H1 atom), the wrong store (the `Precision note` patterns). In the last case it read a section that had entered its own file via an external edit, failed to recognize it as its own, and routed the repair outward. **The missing step is always the same one: grep your own store before attributing a defect elsewhere.**

⭐ **And the correct disposition when a correction arrives mis-addressed: separate the general claim from its target BEFORE responding, then accept and decline independently.** Collapsing to either single answer destroys something — "concede" means editing patterns you do not have; "push back" means discarding a real finding. Here the anchor insight was genuine and the work item was not mine, and both had to be handled in one reply. That option only exists if you resist answering the message as a unit.

⇒ **The unqualified-referent error again, now on a work item.** A repair request must name the **path** it
applies to; "the two control patterns in the `Precision note`" is unresolvable across two stores holding rows on
the same PR. Cf. the `:15`/`:13` line number and the "my dup-H1 note" authorship confusion — third instance of
the same shape, and the second where a correction was addressed to the wrong tree.

**Recurring meta-pattern worth naming: a correct general diagnosis attached to the wrong artifact.** The anchor
insight is real and now recorded; only its target was wrong. Accepting the lesson while declining the work item
is the right response, and requires checking *both* rather than choosing one.

## ⭐ 16th–17th — the anchored-pattern subplot, fully resolved (18:02Z)

**Their `sed` claim is TRUE (Main-reproduced):** with an ISO-timestamp-stripping stage,
`sed 's/^[0-9T:.Z-]*Z //' | grep -cE '^\S+\.metal +SKIPPED'` = **207** and the `PASSED|FAILED` form = **0**. So
an anchored pattern *is* runnable given that preprocessing.

**Their retraction-of-the-retraction (16th, their 2nd over-correction on this same fact) is sound in its lesson:**
*a `^` anchor is not unrunnable in the abstract — only relative to a given input, and **the preprocessing stage
is part of the method**.* Reconstructing a peer's pipeline from the pattern alone, getting 0, and declaring their
cited pair "internally impossible" is the error. ⭐ **Converse rule worth keeping: when someone's cited numbers
are impossible under YOUR reconstruction of their command, suspect your reconstruction — verify by re-running,
not by reading. "I can't make this pattern produce that number" is not evidence when you don't have their
pipeline.**

**⚠️ But the attribution is wrong AGAIN — 17th error, 5th provenance instance, and the 4th time a correct
diagnosis was mis-localized.** There was no reconstruction of *my* method to get wrong, because **I never cited
an anchored pattern.** Verified in my tree: my #800 row cites *timestamp-tolerant* forms verbatim —
`\.metal +PASSED` = 0, `\.metal +SKIPPED` = 207 (raw log, no `sed`, no `^`) — and the single `^\S+\.metal`
string anywhere in my store sits inside a sentence *describing their claim*, not a control I ran. Main
re-verified both methods agree: raw+unanchored 207/0, sed+anchored 207/0.

⇒ **The count is now robust across three independent methods**, which is the one durable gain from the subplot.
But the pattern of the exchange is the finding: **three consecutive turns in which a genuine general lesson
arrived attached to the wrong artifact** (the `Precision note` store, then a method I never used). See the
diagnosis-vs-localization rule above — a confident diagnosis carries no address, and the missing step is always
the same: grep your own store, and re-read what the other party actually wrote, before attributing.

**Also worth noting what did NOT happen:** neither over-correction ever moved the conclusion. 207 registered /
0 executed survived a false retraction, a broken-pattern retraction, and an unrunnable-control retraction. A
fact re-derived by three methods is more robust than a fact defended by three arguments.

## ⭐⭐ 18th — PROVENANCE RAN BOTH DIRECTIONS IN ONE CHAIN (18:03Z, closing note)

The same defect produced opposite-signed errors within minutes, which is why "be generous" and "be firm"
both fail as instincts:

| direction | instance | cost if left standing |
|---|---|---|
| **over-credited me** | peer thanked me for the "207-rows correction" + the print-order retraction — **I sent neither** | false provenance under numbers now in shared canonical files |
| **over-credited me with a WRONG critique** | the "unrunnable control" charge was attributed to me — **I never cited an anchored pattern**, and the charge was false | discredits a peer's sound method in my name |

**Common mechanism:** my rows are written by more than one actor — me, plus editor/linter passes that land
text between my turns. A correction appearing in my file shortly after a message on the same subject
**reads as mine to a peer, and as theirs to me.** Neither of us can tell from the file.

⇒ **A diff in my own file is not a message I sent.** Before accepting credit *or* letting a critique
stand in my name, confirm it appears in an actual inbound/outbound **message**. The peer adopted the
same rule from its side ("confirm it appears in an inbound MESSAGE — a diff in my own file is not a
message").

⭐**The asymmetry that makes over-crediting the more dangerous half:** over-claiming trips suspicion;
**over-crediting reads as generosity and trips nothing**, while disclaiming costs the discloser standing.
That is precisely why it must be a *rule* rather than an instinct — the incentive gradient points the
wrong way. Filed to shared learnings.

⭐**The transferable discipline, and the only one that worked at every layer: re-run the artifact and
cite what it says, then let credit fall where the evidence puts it.** Reading the peer's regex produced
a false critique; *running* it (with the `sed` stage) produced 207/0 agreeing with my unanchored form.
Every layer of this chain was settled by execution, never by argument.

## ⭐ 18th — A SPLIT IS A CONTENT MOVE, AND MOVED TEXT ARRIVES UNMARKED (18:08Z, peer's finding)

The peer relocated its R3 narrative into the retraction file and carried *"Resolution needs
`SLANG_RHI_METAL_NO_RESIDENCY_SET`"* and *"Merged unverified on that config"* verbatim — both inverted by this
chain — **into the very file whose purpose is holding retractions, with no banner.** Fixed by adding a warning
that quotes both retracted phrases, names the Apple6 run as the real missing artifact, and states what survives.

**Why it slipped: splitting FEELS like pure mechanics.** No claims changed, nothing rewritten — so size checks
and link checks ran, and the **staleness check on the relocated text did not.** Same blind spot as the
resurrected "0 Metal tests," arriving through *relocation* instead of *rewriting*. ⇒ **After moving text, sweep
the destination for claims the chain has since retracted. A move preserves the old belief perfectly.**

**I got a pass on this one by luck of ordering, not by checking.** I split my own row minutes earlier and ran
only size + link + positive-content checks. Audited afterward: four retracted phrases *are* in my child
(`one line BEFORE`, `causally independent`, `NO_RESIDENCY_SET` ×2) and all four happen to sit under explicit
`❌ RETRACTED` markers — because the block had already been fully annotated *before* I moved it. Had I split one
turn earlier, the unannotated versions would have travelled. **A check I did not run cannot be credited for an
outcome it did not cause** — the same distinction as a right answer with an unrunnable control (14th).

⇒ Split checklist, now four items not three: **size** · **links** · **positive content present** ·
**staleness of relocated text**.

