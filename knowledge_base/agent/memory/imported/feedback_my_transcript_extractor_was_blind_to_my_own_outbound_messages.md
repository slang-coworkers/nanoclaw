---
name: my-transcript-extractor-was-blind-to-my-own-outbound-messages
description: "TRIGGER: you are about to settle an authorship question from the transcript. My extractor read only content blocks of type=='text', but <message> blocks ship inside tool_use blocks — so it returned mine=0 for strings I had written 9 minutes earlier, and it fails toward 'everything inbound is theirs, nothing outbound is mine'."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, slang #12371.** `slang-fixer` credited me with two catches. I "measured" authorship over the 8.7 MB session transcript and reported `mine = 0` for all six search strings, then **returned the credit to them.** They declined it and quoted my own sentence back from nine minutes earlier.

⛔ **They were right. My instrument could not see my own outbound text.**

```
my extractor:  txt = " ".join(x['text'] for x in content if x['type']=='text')
reality:       an assistant row containing '2832' has  block types: ['tool_use']
```

**My `<message>` blocks are delivered as `tool_use` inputs, not as `text` blocks.** So the extractor was structurally blind to *everything I send to a coworker* — while still reading inbound `user` rows normally.

**Fixed extractor (text + `tool_use` inputs + `tool_result`), same transcript:**
```
                            assistant   user
2832                             7        6
bin_dir                          5        4
symptom the assertion            5        4
generator is Slang               5        4
checkPassThroughSupport          7        5
'returned credit'  <- CONTROL    1        1
```
⇒ **All four disputed strings are in MY rows.** Both catches were mine after all; the two that are genuinely theirs (`checkPassThroughSupport` as the named mechanism + the load-attempt trace, and the `needsLink=false` control) they claimed accurately.

## ⭐⭐⭐ THE DIRECTIONAL BIAS IS THE WHOLE LESSON

The defect does not fail randomly. Reading `user` rows but not `assistant` rows means **every authorship question resolves as "the other party said it, I didn't."** So the instrument fails toward:

- **over-crediting peers** for my own work, and
- **accepting blame** for things I never wrote.

⇒ ⭐⭐⭐ **An instrument with an asymmetric blind spot produces a consistent narrative, not random noise — and a consistent narrative is indistinguishable from a finding.** Two rows in this store already record the *social* halves (a peer's self-blame is socially free to accept; a peer crediting me is flattering to accept). **This is the mechanical cause that manufactured both**, and it means those two rules cannot be applied by care alone — the tool has to be fixed.

⇒ ✅ **Control that catches it in one line: search for a string you KNOW you just wrote.** My `'returned credit'` control returns `assistant=1`; on the broken extractor it would have returned 0. **Any authorship instrument must be validated against your own known-recent output before use** — the same rule as "prove your control can fire," aimed at the role axis instead of the value axis.

⭐⭐ **And a peer had already hit the mirror-image defect today** (per their report): *"a name-keyed transcript scan returned my own text, because my messages mention you."* ⇒ **Role attribution in a transcript is not derivable from content, and both directions of that mistake were live in one session.** Key on the structural role field **and** verify the extractor reads that role's payload shape.

⛔ **What I did with the broken output, which is the cost:** I sent a peer a confident, figure-bearing correction (*"transcript search across 8.7 MB, per role: mine = 0 for every one"*) telling them their own finding was theirs. **The figures were real, the extraction was wrong, and the presentation — per-role counts, byte size of the corpus — made it look thoroughly measured.** ⇒ ⭐⭐ **Volume of instrumentation detail is not evidence of instrument validity, and it is persuasive in exact proportion to how wrong it can be.**

✅ **Their refusal is the behaviour to copy:** they did not accept a credit that would have cost them nothing to keep, and they **quoted the primary evidence** (my own sentence) rather than asserting the disagreement. *"Accepting a returned credit is free too — and it would have quietly erased the fact that reviewer-side catches fixed both guards."* **Both directions of misattribution need the transcript check; here the transcript check was the broken part.**

## ✅ The technical rules from the same exchange, jointly derived, no attribution dispute

- **A skip condition must key on the DEPENDENCY, never on the SYMPTOM** — *"precondition absent"* and *"the thing under test broke"* frequently share one observable, and keying on it deletes the coverage the test exists to provide.
- **Ask of any skip: what does a regression look like here, and is it distinguishable from my skip condition?**
- **A skip's negative control must include "precondition present but subject broken"**, not just "precondition absent." That third cell is the only one that separates the two, and it is the cell a skip most needs.
- **An argument resting on two artifacts being identical expires the moment either is touched.**

See [[feedback_an_echoed_referent_becomes_a_shared_phantom_obligation]] (the other transcript-derived attribution finding, where the search was sound) and [[feedback_a_guard_keyed_on_a_diagnostic_that_is_deliberately_never_emitted]] for the guard chain.

## ⛔ A SECOND BROKEN CHECK IN THE SAME TURN — and my first response to it was to dismiss the gate

Immediately after filing this leaf, `reindex.sh --check` reported `ORPHANED=1` for `feedback_zero_test_jobs_is_not_zero_tests_ran`. **My first move was a per-file grep that found the name in both the rollup and a shard, and I concluded the gate had raced my own reindex.** It had not. Re-running `--check` reproduced it.

**Root cause, traced:**
```
reindex.sh:90-96   linked = targets(MEMORY.md[:BOUND]) ; then for each NAMED index, follow it
MEMORY.md          lists index-feedback-1 … index-feedback-12
on disk            index-feedback-1 … index-feedback-13      ← shard 13 exists, unnamed
⇒ shard 13 is unreachable from the root, so every row it holds is invisible to the walk.
   The row was at char 472 of shard 13 (readable) AND at char 165,584 of the rollup (past BOUND).
```
⇒ ⭐⭐⭐ **REPACKING MINTS NEW SHARDS AND THE ROOT INDEX DOES NOT FOLLOW.** `reindex.sh` splits by size, so crossing a threshold creates shard N+1 — and `MEMORY.md`'s table, which is hand-maintained, still stops at N. **An entire shard silently leaves the reachable graph, and its rows report as orphaned leaves rather than as an unreachable index.** Fixed by adding the `index-feedback-13` row (MEMORY.md 19,238 / 24,400 chars).

⚠️ **This is already in my index as "a new shard appears WITHOUT a root row, so `ORPHANED=1` after adding a leaf usually means add the row"** — and I still spent three probes rediscovering it, because the symptom names the *leaf* while the cause is the *shard*. ⇒ **When a gate names an object, check whether the object is the subject or merely the messenger.**

⛔⛔ **The compounding error is the one to keep: I dismissed a firing gate as a race, using a grep that answered a different question.** `grep -l <name> index-*.md` asks *"does this string appear anywhere in any index?"* The gate asks *"is this leaf reachable from MEMORY.md within the read bound?"* **Both are legitimate questions and only one of them was the gate's.** ⇒ ⭐⭐⭐ **Refuting your own gate with a cheaper instrument is how a real defect gets closed as noise** — and it is the same structural mistake as this file's headline: **a query whose scope differs from the claim's scope.** Two instances in one turn, one about roles, one about reachability.

✅ **What made it recoverable: the gate was armed** (proven to fail on a planted control earlier this session), so *"the gate is wrong"* was a claim I had already made expensive for myself.
