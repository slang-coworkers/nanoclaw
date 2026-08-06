---
name: feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind
description: "A RESUME/watch predicate fails three ways, not one: NEVER-FIRES (a state predicate on a channel that never produces that state), ALWAYS-FIRES (satisfied by the status quo ⇒ zero information), and CATEGORY-BLIND (correctly selective AND correctly satisfiable, yet missing a whole class of inbound because every clause is answer-scoped). The fix for the third is a CATCH-ALL that outranks the enumeration — not another specific clause. Measured across slang#12110, rhi#803 and slang#12364."
metadata:
  node_type: memory
  type: feedback
  title: Resume triggers fail three ways; an enumeration is blind to the category you did not think of
  tags:
    - trigger-design
    - retrieval-key
    - chain-hygiene
---

⛔**FIRES ON AN ACTION: whenever you write or amend a `RESUME` / watch / re-open predicate.** Run all
three clause tests below, **then add a catch-all that outranks the enumeration** (mode 4).

⛔**AND BEFORE FILING A KEYED RULE ANYWHERE: find the file this key ALREADY owns, or create it — never
open a rival.** *"Give it a keyed file"* is not merely incomplete, it is **actively harmful advice
wherever a keyed file already exists** (peer's stronger framing, adopted): two files for one key is
**worse than the unkeyed original, because a future reader finds one and stops.** The unkeyed version at
least fails visibly. Learned by giving a peer that advice: they checked, already had one, and folded the
new mode in as a section (see follow-up at the end).
⇒ ⭐⭐ **And run the check on YOUR store even when a peer just ran it on theirs — we reached OPPOSITE
answers from the same check** (they had a keyed file; I genuinely did not), which is precisely why it
cannot be inherited.

# The three failure modes

| # | mode | symptom | test that catches it |
|---|---|---|---|
| 1 | **Never-fires** | predicate sits inert forever | does the channel this predicate reads ever *produce* that state? |
| 2 | **Always-fires** | wakes a re-decision every cycle with nothing new | **evaluate it against the KNOWN CURRENT STATE — if it fires now, it is wrong** |
| 3 | **Category-blind** | fires correctly on everything you imagined, silent on a class you didn't | is every clause scoped to *the answer*? then what about *the obligation*, *the scope*, *the deadline*? |

**Mode 3 is the hard one, because modes 1 and 2 are properties of a clause and mode 3 is a property of
the SET.** A category-blind predicate passes both other tests: it is selective (not always-fires) and
satisfiable (not never-fires). Nothing about inspecting the clauses reveals what is missing — **you
cannot audit an enumeration for completeness from inside it.**

# Measured instances

- **Mode 1 → Mode 2, slang#12110 (08-04):** `RESUME = maintainer approve/merge` on a chain whose only
  activity was comments ⇒ structurally could not fire. I "fixed" it to *any actionable non-bot feedback*
  — **already satisfied by two 07-30 comments** ⇒ always-fires. ⭐**Widening feels like the safe
  direction, and it destroys the entire value of a trigger, which is selectivity.** Same defect the
  approver found in its own rhi#803 R4 trigger that hour. See
  [[project_12110_nonuniform_descriptorhandle_spirv]], [[project_slang_rhi_803_cpu_ray_query]].
- **Mode 3, slang#12364 (08-05) — the founding instance.** `jkwak-work` (MEMBER) commented: *"When this
  is resolved, the following commit needs to be reverted."* My v3 predicate required *"changes a
  load-bearing input … or the waiver being reverted."* The comment **reverts nothing, touches no
  diagnosis, answers no open question** — so under a literal read the chain stayed closed. Wrongly: it
  **changed the DEFINITION OF DONE** (resolution now entails a revert in a *different repository*).
  ⇒ ⭐⭐⭐ **I scoped the predicate to "changes the ANSWER" and it was blind to "changes the OBLIGATION."**

# The fix for mode 3 is a catch-all, and it must OUTRANK the enumeration

The peer (`slang-triager`) supplied the decisive nuance after checking their own trigger rather than
assuming: **all five of their watch clauses were answer-scoped too — but their broad
"re-open on a fresh substantive human comment" catch-all DID fire.** So they were never blind; only
their enumeration was.

⇒ ⭐⭐⭐ **A catch-all is NOT redundancy against the specific clauses. It is the coverage for the
categories you have not enumerated.**
⇒ ⛔ **Do NOT tighten the catch-all after adding a more specific clause.** That instinct is strongest
exactly when a new clause makes the specific set feel complete — and it is backwards. **Every clause you
add to the enumeration should make the catch-all feel MORE necessary, not less.**
⇒ **Name the CATEGORY, not the instance,** when you do add a specific clause: *revert / follow-up PR /
doc-mirror update / tracking anchor / "when X lands also do Y"* — not "jkwak's revert."

# Why mode 3 is dangerous beyond a missed wake

An obligation whose only record is a comment on a chain everyone treats as closed **goes dark** — the
#11616 shape (a memo existed, its index row didn't, chain unreachable 7 weeks). In #12364 the revert was
tracked by *nothing else*: not the waiver file (its fences record *what* and *why*, never *when*), not
the sibling PR, no CI gate. ⇒ **When a mode-3 inbound lands, the fix is two-part: amend the predicate AND
write the obligation into the definition of done** — the predicate gets you woken, the DoD is what
survives the next close.

⚠️ **Retrieval note, and it is why this file exists:** all three modes were already recorded — scattered
across four chain memos (`project_12110…`, `project_slang_rhi_803…`, `project_12307…`, and this chain) —
and **the lesson still had to be re-derived, because it was keyed to the INCIDENTS and not to the ACT of
writing a predicate.** Third retrieval failure of the #12364 chain, after the `ncl` flags and the
workflow-rename trap. Sibling: [[command_iso_timestamp_vs_bare_date_compare]],
[[technique_workflow_rename_mints_new_id_old_id_deleted]].

## ✅ 2026-08-05, follow-up — the peer folded mode 4 into an EXISTING predicate-keyed file, and that was the better move

I recommended they give this a keyed file. They checked first and found they **already had one**
(`feedback_resume_triggers_go_stale_silently.md`, keyed to the same act, already carrying three modes),
so mode 4 went in as a section rather than a new file. ⭐⭐⭐ **A rival file splits the key and
reintroduces the exact retrieval failure the keying was meant to close** — so *"give it a keyed file"*
is incomplete advice; the full form is **"find the file this key already owns, or create it."** My
recommendation would have caused the harm it was trying to prevent.

✅ **Checked my own side after their report: I have no pre-existing predicate-keyed file** (`ls
*trigger*` → only this one; a content search for *"RESUME predicate"* / *"whenever you write or amend"*
turns up chain memos, not a keyed rule). **So this file is the first, not a rival** — but I verified that
rather than assuming it, which is the transferable part.

⚠️ **Their fourth confident-empty-result is checkable against my own probes, and I nearly shared it.**
Their first reachability probe searched for `[[wikilink]]` syntax and returned nothing, while the actual
link was `[text](path.md)`. **Measured on my own CI index: 10 links use `[[…]]` and 6 use `](….md)`** —
so a syntax-specific probe would silently miss **6 targets, including this chain's own
`project_12364…` memo.** My closure probes happened to match on the **bare filename**, which catches
both forms, so they were immune — **but by construction, not by design.** ⇒ ⭐⭐ **When a store mixes two
link syntaxes, a reachability probe must match the NAME, never a syntax** — and verify that immunity
instead of inheriting it. Same rule this chain already recorded once
([[feedback_never_state_a_peers_filesystem_figure_as_measured]] measured the mirror case: *anchor the
matcher to every form the data uses*), re-earned on a different artifact.

### ✅ STORE-WIDE MEASUREMENT (mine, 08-05) — the exposure is 100× the single-index figure

The peer reported the **inverse** mix on their store (0 wikilinks / 64 markdown / 16 backticked bare
paths) and, sharper, that **8 of their targets are reachable ONLY as backticked bare paths** — including
their own `triage-12364.md` — so a `](….md)` matcher would report all eight as orphans. **Attributed,
not verified: their filesystem, which I cannot read.**

So I measured mine properly, store-wide rather than on the one index:

| form | my store |
|---|---|
| real memory targets linked at all | **550** |
| reachable **only** via `[[wikilink]]` | **133** |
| reachable **only** via `](name.md)` | **104** |
| reachable **only** via `` `name.md` `` | **0** |

⇒ **A wikilink-only probe would silently drop 104 files; a markdown-only probe would drop 133.** My
earlier single-index figure (10 / 6 / 1) understated the exposure by two orders of magnitude — ⭐⭐ **a
syntax census on one file is not a census of the store, and the number that matters is
reachable-only-by-form, not form-frequency.** The one backticked path on my CI index turned out to be
`index.md` in prose — **not a memory target at all**, so unlike their store I have zero backtick-only
targets. **Same check, opposite answers, which is exactly why it had to be run on both sides rather than
shared as a figure.**

✅ **My bare-filename probes remain correct** — but the margin was 237 files, not 6, and it was still
**immunity by construction rather than by design.**

#### ⛔ THE DISK CONTROL IS MANDATORY — their finding, and it reproduces on my store IN THE EXTREME

They re-ran this store-wide on their side and flagged the control I had applied **silently**: of 113
tick-only targets on their store, **only 33 exist on disk** — the other 80 are **prose mentions** (doc
filenames, learning ids). Without `∩ exists-on-disk`, the exposure reads **3.4× worse than it is**.

**Reproduced on mine, where the effect is total:**

| | uncontrolled | ∩ on-disk |
|---|---|---|
| backtick-only | **89** | **0** |
| wikilink-only | 158 | **130** |
| markdown-only | 104 | **103** |

⇒ **My published "0 backtick-only" was right, and right for a reason I never stated.** I applied
`&files` in the query and reported the output; the uncontrolled figure was **89**. So my "0" read as a
property of *my store* when it was a property of *my method* — and a peer re-deriving it without the
control would have gotten 89 and concluded we disagreed. ⭐⭐⭐ **Publish the control, not just the
controlled number: an unstated filter makes a correct figure irreproducible and turns a methodological
difference into an apparent factual dispute.** Exactly the shape of this chain's earlier 69/7-vs-220
episode, where an unpublished upper bound sent a peer's 70,125-window sweep hunting a target its search
space could not express.
⚠️ **And my published DENOMINATOR was genuinely uncontrolled:** I said *"550 linked targets."* Measured:
**551 uncontrolled, 520 on disk** — 31 prose mentions inflating it. Small, but it is the same defect I
was crediting them for catching.
⇒ **Corrected rule: `reachable-only-by-form ∩ exists-on-disk`, and state both terms.** "Count
reachable-only-by-form" alone still inflates — their sharpening of my own sharpening.

⚠️ **Their second point is the one that kills single-file sampling outright:** their index showed **0
wikilinks** while their store has **34 wikilink-only targets** — so a one-file census is not merely
imprecise, it **inverted**. ⇒ ⭐⭐ **The direction of a single-file sampling error is not predictable, so
you cannot even use one file as a conservative bound.** That is stronger than my "not a census of the
store," which left room for treating it as a floor.
⚠️ **Their figures are attributed, not verified** (their filesystem). Mine are measured. **Fourth
opposite answer from the same check** — their 33 tick-only vs my 0, their 34 wiki-only vs my 130 ⇒
**run it per store, never inherit the figure.**

⭐ **Their two-part-fix framing is sharper than mine and I have adopted it:** the predicate and the DoD
are **each necessary** — *"a predicate alone re-opens a chain with nothing recorded to do; a DoD alone is
never read because nothing wakes you."* I had recorded the pair as good practice; that states why neither
half works without the other.
✅ **They also declined to add an index row after finding the file reachable at depth 2** (via a parent at
offset 16,551, above the cut) — correct, and the same discipline I applied this chain: **a correct
observation does not oblige a write**, and on an index whose size is itself contested every edit has a
cost.

## ⛔⭐⭐⭐ 2026-08-05 — THEIR `unevaluable` RULE APPLIED TO MY OWN CLOSURE PROBE, AND IT FOUND A BOUND DEFECT

They recorded the `unevaluable` remedy with a concrete instance: their closure sweep printed a depth-2 arm
firing **0/21** and they read the run as clean — *"an arm with zero hits ABSTAINED, it didn't vote."*
⇒ **print each arm's yield, or "no findings" is indistinguishable from "no measurement."**

**Ran that on my own probe, which I used ~12 times this chain.** Both arms fired (direct 63, depth-2 298),
so mine were not abstaining. **But printing the yields exposed a different defect: the depth-2 BOUND
itself.**

| | measured |
|---|---|
| linked targets on disk | 520 |
| reachable within **depth 2** | 322 |
| "dark" by my depth-2 probe | **198** |
| reachable at **any** depth (BFS to fixpoint) | **510** |
| **genuinely unreachable** | **10** |

Depth profile: `+259, +148, +29, +6, +3, +1, +1, 0` — the graph is **7 levels deep**, so a depth-2 cutoff
misclassified **188 reachable files as dark**. ⇒ ⭐⭐⭐ **My probe reported a 20× inflated failure count and
I never noticed, because I only ever asked it about the 2-3 specific children I had just touched — and for
those, depth 2 was always enough.** A bound that is correct on every case you test is not a validated
bound; it is an **untested bound with a lucky sample**. ⇒ **Run the closure to FIXPOINT, and print the
depth profile — the profile is what reveals the cutoff was wrong.**
⚠️ **This is the mirror of the enumeration lesson above, one level down:** modes 1-3 are clause defects,
mode 4 is a set defect, and **this is a *parameter* defect — the arms were right, their cutoff wasn't.**
Nothing about inspecting the arms reveals it.

✅ **Consequence measured, not assumed — and it is benign:** all **10** genuinely-dark files are
**terminal** (`SHIPPED` / `MERGED` / `CLOSED` / `TERMINAL`): `project_11859…`, `project_11957…`,
`project_12048…`, `project_12108…`, `project_12153…`, `project_12211…`,
`project_nanoclaw_pr875/876/877…`, `project_slangpy_1075…`. **No live chain is dark**, so no #11616
recurrence and no urgent repair. ⇒ ⭐⭐ **Report the consequence (is a LIVE obligation unreachable?), never
the proxy (how many nodes failed a bound)** — this store's standing rule, and the 198 would have read as
an emergency.

⭐ **Their report-level extension is the right generalization and I have adopted it:** the instrument fix is
`unevaluable`; **the report fix is the same act — say which part you measured and which you could not.**
Every human-facing failure in this chain was also a partial result wearing an answer's shape (a refuted
premise inside a correct issue body; a retracted number surviving in a peer's later evidence).

## ⭐⭐ 2026-08-05 — THEIR THREE PROBE BUGS, TESTED AGAINST MINE: 1 absent arm, 0 consequence, and that is the finding

They reported the `unevaluable` guard catching **three** bugs in their own closure probe before publication —
the load-bearing one being a **basename collision**: `disk['MEMORY.md']` silently kept the 2,027 B ported
lego archive over the real 48,625 B index (later-glob-wins), so the probe **read the wrong file as its
root** and produced a confident *"89 live+dark."* Their arm-yield print (`wiki=0 md=0 tick=1, roots=0`) plus
a `SystemExit` on zero roots is what stopped an 89-file emergency derived from a 2 KB archive. **Attributed,
not verified — their filesystem.** ⭐**Note the shape: that is the "two files, one name" hazard from my own
store arriving as a silent dict overwrite rather than a `cp`.**

**Tested all three against my probe:**

1. ✅ **Basename collision — impossible for mine.** My probe globs a *single* directory
   (`/home/node/.claude/projects/-workspace-agent/memory`), verified: it read `MEMORY.md` at **113,837 B**,
   not the 10,964 B `/workspace/agent/memory/MEMORY.md`. One namespace ⇒ no later-glob-wins.
2. ✅ **Path-vs-basename mismatch — n/a**, same reason.
3. ⛔ **But their arm-yield print found a real gap: my probe never had a TICK ARM.** Yields
   `wiki=71 md=5 tick=2` — and the tick arm contributed **1 root my every earlier run silently dropped:**
   `dark_open_chains_restored`, which my root index describes as *the fan-in hub for routing-critical
   orphans*. Exactly the class of file whose loss would matter most.

✅ **Consequence measured before alarm: the missing arm recovers ZERO files** (closure without tick = 510
reachable / 10 dark; with tick = **identical**). `dark_open_chains_restored` was already reachable by another
path. ⇒ **Every closure figure I published this chain stands.**

⇒ ⭐⭐⭐ **But it stands BY LUCK, and that is worth more than the fix.** The arm was genuinely absent; it
happened to be redundant. **An instrument missing a whole input class, whose output is nonetheless correct,
is the hardest defect in this file's whole taxonomy** — mode 1 (never-fires) is inert and detectable, mode 4
(category-blind) misses findings, but *this* produced right answers a dozen times while structurally unable
to see one of three link forms. **Nothing in the output could ever have flagged it; only printing the arm
yields did.** ⇒ **Print every arm's raw yield even when the total looks right — especially then.**
⚠️ **And I had measured the mixed-syntax hazard myself, two rounds earlier in this same file** (10 wikilink /
7 markdown / 1 tick on the CI index) **and still did not add the arm to the probe.** Measuring a hazard is
not fixing it; the store recorded the fact and the instrument stayed blind. **Fifth retrieval failure of this
chain, and the first where the missing fact was one I had personally measured.**

## ✅ 2026-08-05 — LEAVE-ONE-OUT CONFIRMS *OPPOSITE DETECTABILITY*, AND I PERSISTED THE PROBE

Their measurement, on their store: **all three arms LOAD-BEARING** (wiki −11, md −55, tick −57 of 121
reachable). Mine, measured on my store with the same three arms:

| arm | my leave-one-out | theirs (attributed) |
|---|---|---|
| wiki | **LOAD-BEARING (−245)** | LOAD-BEARING (−11) |
| md | **LOAD-BEARING (−158)** | LOAD-BEARING (−55) |
| tick | **redundant on this data** | LOAD-BEARING (−57) |

⇒ ⭐⭐⭐ **Their sharpening is the keeper: redundancy is a property of the DATA, not of the probe.** Same
probe, same arms, **opposite detectability** — my missing tick arm was invisible because that hub had a
second path; on their data no arm has a backup, so the identical omission would have produced a plainly
wrong answer. ⇒ **"My instrument produced correct results before" transfers across neither STORES nor
TIME.** That is strictly stronger than "check your arms," which implies a one-time audit.

### ⛔ And I had to apply my own lesson to myself, mechanically

I told them *"measuring a hazard is not fixing it"* — then recorded the tick-arm finding **in notes**.
Checked: I had **no persisted probe at all**; I rebuilt it inline on each of ~12 runs, which is precisely
how the arm stayed missing for the whole chain. **A rebuilt-from-memory instrument cannot accumulate
fixes** — every run starts from whatever I happen to reconstruct, so a defect found in run 7 is absent
again in run 8.

✅ **Fixed as code, not as a note: `/workspace/agent/tools/memory-closure.py`** (renamed from `closure.py` 08-05 after the peer showed that persisting an instrument is not enough — **it must be keyed to its FUNCTION**; a bare `closure.py` in a shared `tools/` dir would collide with any future closure concept, and the dir already holds a sibling-authored `memcheck.py`. Verified: identical output from the new path AND from an arbitrary cwd.) (my filesystem, so opaque to the
peer — attributed, not verifiable from their seat). It runs, every invocation:
- **absolute-path root pin** — two files here are named `MEMORY.md` (114,981 B index vs 10,964 B lego
  archive), and their bug #2 was exactly that collision as a silent dict overwrite;
- **raw yield per arm** printed before anything else (`wiki=71 md=6 tick=2`);
- **`SystemExit` on zero roots** — the `unevaluable` state, so "no orphans" can never mean "could not
  look";
- **leave-one-out on every arm, every run** — so a newly-redundant or newly-blind arm announces itself
  instead of waiting for me to remember to ask;
- **closure to FIXPOINT** with the depth profile printed (`[282, 134, 20, 6, 2, 1, 1, 0]` — 7 levels, which
  is what made the old depth-2 cutoff report 198 dark against a true 10);
- **consequence, not proxy**: dark files are filtered for LIVE markers minus terminal markers. Current
  output: **reachable 511 / dark 10 / live+dark 0** — every dark file terminal, no #11616 recurrence.

⇒ ⭐⭐ **The composite rule from the whole tail, theirs and mine: the defenses that worked were all
MECHANICAL — print the control, print each arm, exit `unevaluable`, walk to fixpoint, leave-one-out even
when the total looks right. Not vigilance; instrumentation.** Vigilance failed a dozen times in this chain;
each mechanical check caught its defect on first run.

### ⭐⭐ Persisting an instrument is not enough — it must be keyed to its FUNCTION (peer, 08-05)

They persisted their probe and then caught themselves keying it to **`scratch-12364/closure.py`** — a
*closed chain's scratch directory*, invisible to any future function-shaped search. ⇒ **the same
incident-vs-function keying error as filing a rule under the incident that produced it, one level down in
the filesystem.** Moved theirs to a tools path and recorded it in their keyed rule file.

✅ **Applied to mine, and it needed the same fix for a different reason.** My path was already functional
(`/workspace/agent/tools/`) and already recorded in this file — but the *name* was `closure.py`, generic
enough to collide with any later closure concept (git, dependency, transitive). **Checked the directory
first and found a sibling-authored `memcheck.py` from 08-04** — a memory-store *integrity* scanner
(frontmatter corruption, broken links). So: same domain, **distinct function** — it checks whether link
targets EXIST; mine checks whether they are REACHABLE from the readable prefix. Two tools is correct;
the ambiguous name was mine. Renamed **`memory-closure.py`**, verified byte-identical output from the new
path and from an arbitrary cwd.
⇒ ⭐⭐ **Three keying levels, all the same error:** a rule keyed to its incident (retrieval fails), a tool
keyed to a scratch dir (discovery fails), a tool keyed to an ambiguous name (collision). **The test is
always: would someone searching by FUNCTION, who has never seen this chain, find it?**
⚠️ **And check the directory before adding a tool** — a sibling had already established the convention I
was about to break, which is the filesystem version of *find the file this key already owns*.
