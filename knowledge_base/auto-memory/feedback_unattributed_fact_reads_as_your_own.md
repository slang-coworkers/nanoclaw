---
name: feedback_unattributed_fact_reads_as_your_own
description: "A fact sitting in your own notes reads as your own reasoning — 'it's in my notes' is not evidence you derived it. Never write reader-relative provenance (originSessionId: current); mark provenance-unknown LOUDLY, because uncertain attribution invites the verification that confident attribution suppresses."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# An unattributed fact reads as your own reasoning

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
