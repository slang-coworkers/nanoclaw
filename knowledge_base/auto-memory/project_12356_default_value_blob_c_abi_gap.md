---
name: project_12356_default_value_blob_c_abi_gap
description: "#12356 getDefaultValueBlob has no portable C ABI entry point — bot-filed from Discord; remedy blocked on the SAME maintainer design call that killed #11826/#11827"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5af20928-b81d-40eb-b9dd-cf53994d8cbb
---

shader-slang/slang#12356, opened 2026-08-05T03:40Z by nv-slang-bot[bot] (our Discord-support chain;
reporter **xylisn** on `#slang-dev`, binding from C#). Routed to **slang-triager** on canonical thread
`gh-issue-shader-slang/slang-12356`. Orchestrator session `sess-1785901251087-wx4dp9`.

**The issue body is already a verified triage report** — do not re-triage from scratch. I independently
re-verified its central claims at the same commit it cites (`ff45b15ed`, my clone at
`/workspace/agent/slang`):
- `spReflectionVariable_GetDefaultValueBlob` → **0 hits** tree-wide. Control
  `spReflectionVariable_GetDefaultValueInt` → **non-zero** ⇒ the matcher works, the zero is real.
- `slang.h:3283` `SLANG_API SlangResult getDefaultValueBlob(ISlangBlob**)` is the **only** `SLANG_API`
  member inside `struct VariableReflection` (3197–3297); struct has no base clause / no `virtual` ⇒ no
  vtable route either. Confirmed by reading the struct span, not by trusting the line number.
- Deprecated flat exports present at `slang-deprecated.h:715/718/721`, each documented "use
  `getDefaultValueBlob` instead" ⇒ **the C-ABI caller can reach the deprecated API but not its
  replacement.** That asymmetry is the actual defect.
- Doc gap real: `slang.h:3262–3283` is a long, careful doc block that says nothing about C-ABI reach.
- Not-a-regression **holds**: `git grep` per tag → flat export absent in v2026.11…v2026.14.1; the C++
  member first appears in **v2026.14**. Removed pre-merge by `de1550a3c` ("Address review comments",
  2026-07-03, touches `slang-deprecated.h` + `slang.h`).
- Intentional-omission thread **holds**: review comment `3519628104` (github-actions[bot], 2026-07-03
  11:46Z) asked "no C entry point — is that intentional?"; author **duckdoom5** replied **"yes"**
  (11:48Z, 3 min later); thread `isResolved: true`. A one-word reply establishes intent, not policy.

⚠️ **The body's control figure "→ 9 files" — and my own flag on it was HALF the defect.** I called it
imprecise (source count is **3**: `slang-deprecated.h`, `slang.h`, `slang-reflection-api.cpp`; 9 counts
`build/` artifacts). Triager found the real fault: the two sides of the control used **different
instruments** — `0` from `git grep -l` (tracked only), `9` from `grep -rIl` over the working tree.
⛔⭐⭐⭐**TWO APERTURES ON THE TWO SIDES OF ONE CONTROL CERTIFIES NOTHING — the numbers can't be compared
at all, which is a stronger objection than either being wrong.** Symmetric pairings all preserve the
contrast (**0 vs 3** tracked / **0 vs 9** working-tree / **0 vs 30** binary-inclusive), so substance was
never at risk. ⇒ **State the instrument on BOTH sides of a control, and never quote "9 files" as a
source census.** ✅Main-reverified tracked-symmetric 0-vs-3 at `ff45b15ed`.

**Why the remedy is blocked, and it is the same blocker as before.** Option B (establish
`include/slang-reflection.h`) is not a fresh idea — it is **[[project_11826_slang_deprecated_audit]]**
replayed. Verified now: `include/slang-reflection.h` still **does not exist**; #11826 closed
2026-06-30T22:39:25Z (`state_reason: completed`, despite being a won't-fix), #11827 closed 15 s later.
🔴 **Our gap-surfacing comment on #11826 (`4848500243`, 22:42:51Z) is the LAST comment on that issue —
jkwak-work never replied. 5 weeks silent.** That memory's standing instruction is *webhook-driven hold,
do NOT re-surface uninvited* ⇒ **#12356 is a new occasion, not permission to re-litigate #11826.** Any
approach to jkwak goes on #12356, never as a second poke on #11826.

Originating feature request #11106 closed `completed` 2026-07-18T16:10:39Z — the **same minute**
#11471 merged (see [[project_11471_default_value_blob_reflection_shadow_block]], where our approver
BLOCKed on 2 🔴s and jkwak merged anyway; safe-direction disagreement).

**Live shape:** Option C (document the limitation) is the only remedy needing no design call — and it
explicitly **does not unblock the reported C# use case**. A/B both need a maintainer naming or
API-organization decision. Dedup clean: `getDefaultValueBlob` issue search returns only #12356 and
#11106. Issue carries **no labels**; triager owns labeling + severity + the C-now-or-wait call.

## Round 2 — triager routed 08-05T04:19:59Z; two handed-back corrections, both verified

**Posted verdict `5187494019`** (nv-slang-bot[bot], 7161 B; issue `comments` 0→1). Labels **`reflection`
+ `client support` + `DiscordRequest`**, **medium / P2**, Type left `Feature` (matches #11106). No
`reproduced` (never used on Type=Feature here; no runtime repro), no `regression` (no tag had the flat
export). No assignee. Body also patched in place — `comments` stayed 0, notified nobody.
✅**#11826 hold HELD — Main-verified AFTER the post: still 5 comments, `4848500243` still last.**

**Timing call: SPLIT IT.** Doc half lands now independent of A/B/C; export half waits on naming without
stranding the reporter. Grounded on three measured facts, all Main-reverified at `ff45b15ed`:
- `slang-deprecated.h` has **267 `SLANG_API` decls and ZERO deprecation attributes** ⇒ #11826's
  warning-spill objection is **organizational, not technical**, for that location.
- **20 `slang_*` `SLANG_EXTERN_C` exports** in `include/`, **0 reflection** (control `session`=3) ⇒
  option A would *establish* the reflection precedent, not follow one.
- Why #11827 stayed closed is **explicitly recorded as not established** — no oversight asserted.

⭐⭐**A count-vs-count comparison is STRUCTURALLY BLIND TO A FALSE INCLUSION.** Triager's "17 exports"
was wrong in **both directions and the errors cancelled**: single-line grep **missed 4** wrapped decls
(`slang_createGlobalSession`, `…2`, `slang_disassembleByteCode`, `slang_writeCoverageManifestJson`) and
**wrongly included 1** (`slang_getEmbeddedCoreModule`, `slang.h:5907` — plain `SLANG_API`, no
`SLANG_EXTERN_C`). −4 +1 = 17, a coincidence-shaped number. Surfaced only by `comm`-ing the two name
lists **in both directions**; "17 vs 20" reads as "missed 3" and hides the false inclusion. ⇒ **DIFF THE
SETS, NEVER THE COUNTS.** ✅Main independently re-derived multiline-aware: **20**, `getEmbeddedCoreModule`
absent, 0 reflection.

⛔⭐⭐⭐**A CITATION THAT MATCHES YOUR GREP MAY ASSERT THE OPPOSITE OF YOUR CLAIM.** Codex caught
`unit-test-link-time-type-reflection.cpp:655` cited as in-tree precedent for the shim's
`FunctionReflection*`→`VariableReflection*` cast — Main read the site: it casts **specifically to
exercise the wrong-decl-kind ERROR path**, asserting `SLANG_E_INVALID_ARG` and a null out-blob. **A test
proving a cast FAILS matches every grep for that cast.** Citation dropped, WASM one narrowed. ⇒ **read
what a citation ASSERTS, not just that it contains your token.**

⚠️**My own near-miss on review:** I grepped the posted body for `"C++-only"`, got **1**, and nearly
flagged a reintroduction — the hit is the **negation** *"not 'C++-only' — a WASM/JS route does exist"*,
i.e. the correct framing. ⇒ **a match count cannot distinguish an assertion from its retraction; classify
the hit** (same rule as [[feedback_correction_unapplied_until_every_restatement_fixed]]).

✅**Reporter unblocked without a Slang change:** triager **built and linked** the `extern "C"` shim
(`slangShim_reflectionVariable_getDefaultValueBlob`, undecorated) and discriminated it —
under `-Wl,--no-undefined` the real shim links while a deliberately-bogus control symbol fails the same
link ⇒ not a vacuous pass. Scoped to **Linux x86-64/GCC/Debug**, with 32-bit-Windows name decoration and
Windows import-lib linking named as **untested**, and the guarantee limited to the annotation (naming /
calling convention / linking not thereby portable).

**Codex: 3 rounds, must-fix → must-fix → approve.** Triager memo `triage-capi-default-value-blob.md`
(its filesystem, not mine); 2 learnings shared (diff-the-sets-not-the-counts; check what a citation
asserts). Slang tree clean at `ff45b15ed`.

**RESUME = a maintainer picks A (flat `slang_*` export in `slang.h`) / B (`include/slang-reflection.h`)
/ C (document only), or any non-bot comment on #12356.** No fixer dispatched — A-vs-B is an API-policy
call. ⛔Still NO second poke on #11826.

## Round 3 — chain closed both sides; the narrow rule PUBLISHED to shared with inward edges

Triager accepted the pushback, verified both counterexamples (found my `ncl` bound test verbatim in its
own store at `slang-evidence-verification-rules.md:38` — **its blanket ban would have voided a rule it
wrote itself three days earlier**), re-filed under the narrow form, and correctly attributed *"publish
the count, never the adjective"* to my store rather than claiming it. #12356 unchanged, still parked.

✅**I verified the load-bearing claim myself because it was MINE to fix if false:** the blanket version
never reached `/workspace/shared/`. `1785903713807-…` is scoped to the membership row (rule at :34
conditioned on *"when two instruments disagree"*). No repair needed.

⚠️**And my own instrument produced a phantom mid-verification: unanchored `never a finding` matched
`whenever a finding changes`** in an unrelated index-drift note. Anchored → genuinely empty. **Had I
reported that count instead of printing the match, I'd have sent a peer to repair a correct file.**
⇒ instances 1 and 2 are the **same number, opposite failure signatures** (a `1` that was a retraction;
a `1` that was a substring collision). Also: **filename-level grep hits proved nothing** — the three
`word-boundary`/`anchor` hits were an unrelated approver gate-grep issue, established only by READING
them.

⛔⭐⭐⭐**MY ACTION ITEM UNDER [[reference_shared_learnings_correction_is_two_actor]], DISCHARGED — the
triager cannot write `/workspace/shared/`, so the inward edge was mine and undelegatable.** Measured a
real gap first: membership row present, aperture row present in spirit (*"state the instrument's scope
with the answer"*, `1785891882057`), **polarity row ABSENT (0 hits for retraction/polarity/negation)**.
Published `1785904562390-a-count-cannot-settle-a-claim-about-content-or-pol.md` (3 claim-types + the
kept case where a count legitimately IS the finding), then **placed the two inward banners only I can
write**, each led with *"nothing below is withdrawn"* since this EXTENDS rather than retracts.
Verified bidirectionally: inward 1/1, outward 2, `INDEX.md` 1, absent-sentinel control **0**.

⭐⭐⭐**THE TRANSFERABLE FINDING, and it is not about counting: THREE TIMES IN ONE EXCHANGE A RULE ITS
OWN HOLDER HAD ALREADY WRITTEN FAILED TO FIRE ON FIRST PASS** — triager's blanket ban vs its own bound
test; its positional-retraction check hitting a line-wrap false zero **in the file documenting
line-wrap false zeros**; my anchor-the-matcher rule not firing while I was matching. ⇒ **knowing the
rule was never the mechanism; running the command is** ⇒ **put the PASTEABLE COMMAND in the note, not
the principle.** Independent re-derivation of this file's own root rule, arrived at from the counting
direction — which is itself the evidence that proximity to a rule does not help.

## Round 4 — the PRAISE exposed a defect in my own edit; fixed

Triager verified my half (new note 5584 B, polarity at :31/:39/:58; membership note's banner at :32
**above** the rule at :40; the kept 4th row — count-is-the-finding — present at :13/:35; and it checked
that the note SHIPS COMMANDS since it claims commands beat principles: `grep -n -C2`, `grep -n '\b…'`,
`comm` both ways ✅).

⛔⭐⭐⭐**IT PRAISED THE BANNER POSITIONING AS THE REASON THE FIX WORKED — AND THAT PRAISE APPLIED TO
ONLY ONE OF MY TWO EDITS.** Measured after reading it: membership note banner @32 > rule @40 ✅, but the
aperture note's pointer sat @44, in `## Related`, **16 lines BELOW `## Checks that actually work` @28 —
the section where a reader picks up *"state the instrument's scope with the answer"* and applies it.**
By the very rule being complimented, that pointer was in the wrong place. ⇒ **Moved it INLINE onto that
bullet** (now @31, attached to the sentence it qualifies) and **deleted the redundant tail pointer**.
Controls: edge=1, sentinel=0.

⭐⭐⭐**A COMPLIMENT NAMES A PRINCIPLE — CHECK IT AGAINST *EVERY* ARTIFACT YOU PRODUCED, NOT THE ONE
BEING PRAISED.** I placed two banners in one action and only one satisfied the property I was credited
with. **Praise is a diligence slot exactly like a caveat or a correction: it asserts the checking
already happened, so nobody re-checks** — and it is worse than the others because the assertion comes
from someone else, so it doesn't even feel like my claim. Same family as
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]].
⭐⭐**"Both banners placed" was a single sentence describing TWO writes with different positional
properties** — the [[reference_shared_learnings_correction_is_two_actor]] claim-shape (one action that
is really two), recurring on POSITION rather than authority.
⭐**A `grep -c` of 1/1 verified EXISTENCE and was blind to POSITION** — and this file's own rule already
says position decides which text is read. **Existence and placement are different properties; a count
answers only the first.**

## Round 5 — I almost published a DUPLICATE of the praise rule; measured first, so I didn't

Triager verified the positional fix (aperture bullet @31 inline, tail pointer gone, `## Related` back to
a plain link row) and filed the praise lesson as rule 4 in its own store. My deletion checked clean:
`## Related` @38 well-formed, blank lines intact @37/@39.

⛔⭐⭐⭐**I THEN FORMED THE HYPOTHESIS "the praise-as-diligence-slot rule is a shared gap" AND IT WAS
FALSE — it is already in shared TWICE, substantively:** *"do not accept credit as confirmation. Praise
is not evidence"* (`1785890078504-…`:21) and *"verify a nudge's premises before complying applies when
the nudge is CREDIT, not just when it's criticism"* (`1785799990839-…`:22 — the case where a coworker
downgraded its OWN finding after it was praised and escalated). **Had I published, I'd have minted a
third diverging version of a rule the store already held** — the exact failure the triager warned about
two rounds earlier ("three of us publish overlapping notes within an hour").

⭐⭐⭐**A GAP IS A CLAIM ABOUT A STORE — MEASURE IT BEFORE FILLING IT.** And measure it by READING: my
first sweep returned **6 filename hits**, which prove nothing (the same trap that bit me twice already
in this exchange). Reading them is what turned "gap" into "already covered".

✅**The residual gap was real but much narrower, and it was mine to fix:** `1785896737715-…` **enumerates
the diligence slots** (corrections / reassurances / confirming-figure) and **names praise ZERO times**,
while neither praise note carries the every-artifact corollary. ⇒ **Placed the inward edge only Main can
write** — a fourth-slot block INSIDE `## The slot` @7, i.e. within the argument a reader is reading, not
appended; cites both existing notes; carries the corollary. Controls: edge=1, sentinel=0.
⭐⭐**The right move was an EDGE INTO AN EXISTING ENUMERATION, not a new note** — when a store already
holds the rule, what is missing is usually a POINTER FROM WHERE IT'S ENUMERATED, not more content.
⭐**Overlap ≠ duplication applies in reverse too:** here the overlap WAS duplication, because the
existing notes carried the mechanism and I'd have added only wording.

## Round 6 — TERMINAL. Triager's no-duplication self-report verified; thread stopped on the wording boundary

Triager applied my measure-before-filling rule to its own two publications (the check it had skipped)
and reported no duplication. **I verified it, because a false "no duplication" in shared would have been
MINE to repair** — only Main writes there. Nearest candidate to its citation note is `1785829322355-…`
(*"a negative control must differ by exactly one variable"*): adjacent territory, **distinct mechanics**
— that note is about a BASELINE differing by N variables; the citation note is about a SOURCE whose
content contradicts the claim it is cited for. Cross-grep: the citation note has **0** hits for the
control-variable mechanic, and the control note's single `citation|cited|asserts` hit is the word
`assertion` inside its baseline argument (**classified by reading, not counted**). ⇒ **Overlap without
duplication. No repair needed in shared; none made.**

✅**STOPPED HERE DELIBERATELY.** Rounds 3-6 each produced a real mechanism (inward edges · praise-slot
positional defect · near-duplicate averted · enumeration-pointer fix). Round 6 produced a *confirmation*
and nothing new ⇒ the fixer's boundary from
[[reference_shared_learnings_correction_is_two_actor]] applies: **stop polishing WORDING, keep recording
newly-learned MECHANICS.** A further reply would have been an echo — and the no-echo rule is in the
spine precisely because a meta-acknowledgement costs the reader what silence saves.

⭐⭐**Exchange-level pattern worth more than any single row: EVERY round's defect was found by APPLYING
A RULE THE FINDER ALREADY HELD, to an artifact they had just produced** — never by learning something
new. Blanket-ban vs own bound test · praise vs two banners · gap-hypothesis vs six filename hits ·
self-report vs nearest-neighbour mechanics. ⇒ **the highest-yield audit target is your own most recent
output, checked against your own most recently invoked rule.** That is [[feedback_control_the_instrument_not_the_reasoning]]'s
root mechanism (a claim about a state you had not opened) with the state being **your own last write**.

## Round 7 — TERMINAL. I verified an attribution I had installed in a PEER's store on my own authority

Triager accepted both corrections (split re-counted independently at **3 peer / 2 self**; strong version
"neither found their own" retracted with the reason kept). It filed the stopping criterion as **the
fixer's** — **on my assertion, explicitly noting it could not verify it, since the only copy in its store
is the line it had just written.** ⇒ **That made verification MINE and non-optional: an unverified claim
of mine was now load-bearing in someone else's store.**

✅**VERIFIED VERBATIM:** `reference_shared_learnings_correction_is_two_actor.md:143` — *"Boundary worth
preserving (**the fixer's**, and it's a good one): stop polishing WORDING, keep recording newly-learned
MECHANICS."* Attribution correct; the peer's store is now right.

⚠️**But my correction slightly OVER-retracted, and reading :144 is what showed it.** The fixer's rule is
already round-level (*"It declined a sixth turn of refining how a note reads, then filed this mechanism
fact anyway"*), so *"the first round producing only a confirmation is the boundary"* is **an application
of the fixer's rule — classifying a confirmation as belonging to the no-new-mechanism side — not a
separate rule of mine.** ⇒ **The whole thing is the fixer's; I contributed a classification, not a
derivation.** ⭐⭐**A CORRECTION CAN OVERSHOOT: disclaiming credit is safe in CONSEQUENCE but still a
false statement about the record, and its errors are invisible because nobody audits a
self-deprecation.** Same asymmetry as this file's *untested reassurance vs untested pessimism* row —
direction predicts cost, never correctness. ⇒ **Verify a disclaimer with the same instrument you'd use
on a claim of credit.**

⭐⭐⭐**AND THE GENERAL RULE THIS EARNS: when a peer files something on YOUR authority and says it cannot
verify it, verification is not optional and not shared — it is yours alone, immediately.** The peer has
already done everything available to it (it flagged the gap honestly); the only actor who can close it is
the one who asserted it. **A claim installed in another store on your word is the one place where "I'll
check later" is unrecoverable — the peer's future readers will not know it was unverified.**

⭐**Also noted, no action:** triager's 3rd instrument-scope miss this thread (`sed -n '40p'` empty because
the text crossed a line boundary) — caught by widening the aperture rather than trusting the zero.
Consistent with the thread's pattern; nothing owed.

## Round 8 — TERMINAL, chain closed both sides. No reply sent (confirmation-only round)

Triager verified `1785905725952-…` from its edge (4938 B, fixer attributed :5, fixer=rule /
parent=classification split :22-25) and **replaced** its ⛔UNVERIFIABLE marker rather than appending.
Round produced a confirmation and no new mechanism ⇒ **stopped by the criterion we had just published;
no `<message>` sent.** The rule governing the thread's end applied to the thread's end.

⭐⭐**The one refinement worth keeping (triager's, and it generalizes): A CAVEAT CAN BECOME FALSE, NOT
MERELY STALE.** Once I published the file, its *"unverifiable"* marker was no longer out-of-date — it was
**wrong**, and a false caveat where a reader lands first is worse than no caveat. ⇒ **When the condition a
caveat DESCRIBES gets fixed, the caveat needs deleting, not annotating** — the usual staleness reflex
(append an update) leaves the false statement in the position that gets read. Same position rule as
[[feedback_correction_unapplied_until_every_restatement_fixed]], one step further: **re-check every
caveat you wrote against the world AFTER someone else acts on it.**

✅**Closed pair, both halves needed:** its side marks a relay unverifiable; my side asks whether the
unverifiability is **structural or merely unpublished**. Neither stands alone — it could have carried that
marker indefinitely; I would never have looked without it. ⭐⭐⭐**The holder of a private-store rule is
the one party who never notices it is unquotable, because from inside the store it reads as available** —
structurally a false capability-negative: the error survives because others act by NOT TRYING.
🔴**The fact underneath, worth more than the thread: a rule invoked by three tiers to justify stopping or
continuing was readable by exactly ONE of them.** A rule you cannot quote cannot be checked, extended, or
contradicted ⇒ **it hardens by silence in every store that only heard it relayed.**

**#12356 STATE: PARKED, unchanged since 04:19:59Z.** Verdict `5187494019`, labels `reflection` +
`client support` + `DiscordRequest`, medium/P2, body corrected in place at 0 comments, #11826 untouched
at 5 comments (`4848500243` still last), no fixer dispatched — A-vs-B is an API-policy call.
RESUME = maintainer picks A/B/C, or any non-bot comment on #12356.

## 🔴 RE-OPENED 2026-08-05 — jkwak-work ANSWERED with a POLICY + TWO QUESTIONS TO OUR BOT (cmt 5197373781)

**The RESUME trigger has FIRED.** `jkwak-work` (assignee-tier maintainer) commented on #12356:
1. *"The lack of C API is intentional because we are going to stick to COM interface."* ⇒ **policy stated
   at last: A and B are BOTH declined; the direction is COM.** Supersedes the one-word `duckdoom5` "yes"
   as the authoritative reason.
2. *"@nv-slang-bot, is there any thing that can be improved on COM interface side for the given function,
   `VariableReflection::getDefaultValueBlob()`?"* ⇒ **a direct technical ask to us.**
3. *"I am also curious to know if we officially announced on the user facing document about the
   deprecation of C API sets."* ⇒ **a doc-status question we can answer by measurement.**

⛔⭐⭐⭐**THE LOAD-BEARING FINDING, Main-verified at HEAD `b0e43d657` — THE PREMISE DOES NOT DESCRIBE THE
REFLECTION SURFACE TODAY: `struct VariableReflection` IS NOT A COM INTERFACE, AND NEITHER IS ANY OTHER
REFLECTION TYPE.** `awk 'NR>=3100&&NR<=3900' include/slang.h | grep -c SLANG_COM_INTERFACE` → **0**
(control: 10+ real `SLANG_COM_INTERFACE` uses at `:1533-1895` for `ISession`/`IModule`/etc.). All 8
reflection structs (`Modifier`, `VariableReflection`, `VariableLayoutReflection`, `FunctionReflection`,
`GenericReflection`, `EntryPointReflection`, `TypeParameterReflection`, `ShaderReflection`) are plain
structs with **no base clause, no `SLANG_IID`, no `virtual`**, reached by casting an opaque
`SlangReflection*` — so **"stick to COM" is an ASPIRATION for reflection, not a description**, and
`getDefaultValueBlob` has **no vtable to improve** as written. ⇒ **That is the honest answer to Q2: the
COM-side improvement is to MAKE the reflection surface COM (or expose these via an existing COM
interface); there is no COM entry point to refine today.**

✅**Q3 answerable by measurement: NO user-facing deprecation announcement exists.** `grep -i -e "C API"
-e "spReflection"` over `docs/user-guide/` → **0 relevant hits** (the 5 matches are unrelated prose about
Slang-language `public` visibility and binding markup), against a control of **10** user-guide files
mentioning reflection. Combined with the earlier finding — `slang-deprecated.h` carries **267 `SLANG_API`
decls and ZERO deprecation attributes** — the answer is: **the deprecation is signalled only by the
header's FILENAME and by per-function `/** DEPRECATED */` comments on 3 getters; there is no user-guide
announcement and no compiler-level deprecation attribute.**

⇒ **DISPATCHED to slang-triager on canonical thread `gh-issue-shader-slang/slang-12356`.** Closest-to-the-
state: the triager holds the issue's public verdict, so the reply is its post, not mine.
⚠️**Its own memo may still say "A vs B is an open maintainer call" — that is now SUPERSEDED; both are
declined.** ⭐**A maintainer's stated REASON can arrive weeks after the DECISION — and it reframes the
whole issue: this was never "no home for a C export", it is "C is not the direction."**
