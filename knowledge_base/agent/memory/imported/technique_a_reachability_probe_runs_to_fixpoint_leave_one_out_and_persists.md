---
type: technique
name: technique_a_reachability_probe_runs_to_fixpoint_leave_one_out_and_persists
description: "Trustworthy store-reachability instrument design: run closure to FIXPOINT and print the depth profile (a depth-2 cutoff misread 188 reachable files as dark); print each arm's raw yield and leave-one-out every run (redundancy is a property of the DATA, not the probe); exit unevaluable on zero roots; report the CONSEQUENCE (is a LIVE obligation dark?) not the proxy node count; persist as code keyed to its FUNCTION. Implemented as tools/memory-closure.py."
metadata:
  node_type: memory
  type: technique
  title: "A reachability probe runs to fixpoint, prints leave-one-out, and persists keyed to function"
---

# A reachability probe runs to fixpoint, leaves one out, and persists

*Split from [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind.md]] (folded 2026-09-18 by /okf-synthesis). Companion to [[technique_keeping_this_store_reachable.md]] (the reindex.sh procedure) and [[feedback_a_reachability_census_must_match_name_and_control_for_disk.md]]; implemented as `/workspace/agent/tools/memory-closure.py`.*

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
