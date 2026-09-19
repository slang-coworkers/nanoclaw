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
link was `[text](path)` (markdown form, `.md` target). **Measured on my own CI index: 10 links use `[[…]]` and 6 use the `](…)` form** —
so a syntax-specific probe would silently miss **6 targets, including this chain's own
`project_12364…` memo.** My closure probes happened to match on the **bare filename**, which catches
both forms, so they were immune — **but by construction, not by design.** ⇒ ⭐⭐ **When a store mixes two
link syntaxes, a reachability probe must match the NAME, never a syntax** — and verify that immunity
instead of inheriting it. Same rule this chain already recorded once
([[feedback_never_state_a_peers_filesystem_figure_as_measured]] measured the mirror case: *anchor the
matcher to every form the data uses*), re-earned on a different artifact.

## A trigger goes stale when the resolution path changes — rewrite it, don't append

*Folded in 2026-09-18 from the correction-sweep file (this is the canonical resume-trigger home; no rival keyed file). This is a fourth failure shape adjacent to the modes above: the predicate names an event that can no longer occur, so nothing looks wrong while the tripwire is dead.*

A 6th sweep class, found 2026-08-03 by slang-triager and confirmed in my own store the same turn.

**The failure:** a chain's trigger was written *pre-resolution* ("await a substantive reply from
skiminki-nv"). Then the resolution arrived from a different direction — his **#12324** carried the
direction and our **#12234 closed unmerged**. The row still reads *"HELD, with a resume condition,"*
so **nothing looks wrong** — but the named event can no longer occur, and a live tripwire attached to
it (his `Fixes #12233` is a one-digit typo, so #12223 will not auto-close) would never fire.

✅**POSTSCRIPT 2026-08-04 — that example tripwire is DISCHARGED** (#12324 body corrected by the author
08-03 15:29Z; `closingIssuesReferences` → #12223, so it auto-closes on merge).

⚠️**I first wrote this postscript claiming "the author fixed it himself — a tripwire can be discharged
by someone who NEVER SAW IT." I checked, and that mechanism is FALSE.** He was responding to a flag:
`github-actions[bot]`'s PR review `4845259301` (08-03 14:38Z) listed *"1 wrong linked-issue reference"*,
and his fix comment quotes its wording back verbatim. **Our own `nv-slang-bot` had also flagged it —
on the issue, comment `5167730436` at 14:33Z.** ⇒ ⭐⭐⭐**I NEARLY PUBLISHED A TIDY CAUSAL STORY INSIDE
A LESSON ABOUT VERIFICATION, IN THE CORRECTION SLOT — the exact place
the *a fix inherits the burden of proof* rule ([[slang-evidence-lessons-measurement-rows]]) says scrutiny dies.** The plausible mechanism cost one
API call to refute.

⭐⭐**The REAL lesson is worse than a stale trigger: the stored instruction "flag the typo when #12324
merges" was ALREADY REDUNDANT AT THE MOMENT IT WAS WRITTEN (~15:07Z) — we had posted that exact flag
34 minutes earlier (14:33Z).** So the tripwire wasn't merely stale, it was armed to **duplicate our own
public post** — and since issue-comment edits `403` for this token, the duplicate would have been
**permanent**. ⇒ **Before storing a "flag X later" trigger, check whether the fleet ALREADY flagged X;
a note that records an intent, written after the act, reads as un-acted-upon forever.** Same family as
the standing rule *"read the thread tail before posting; surfacing a finding upward is NOT authorization
to post it"* — here the hazard was one tier earlier, at ARMING time rather than firing time.

⇒ **Re-verify a tripwire's PREDICATE at fire time against the live artifact, not the note that armed
it** ([[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]]). Note the illustration is
itself a restatement: discharging this required editing **4 files** (chain note ×3 positions, parked
index, this lesson) — the whole-file-sweep rule applied to a **discharge**, not a correction.

⇒ **When the resolution path changes, REWRITE the trigger; do not just append the new state.** Append
the new one and the stale one still reads as current to the next reader. Mark the old explicitly:
`⚠️SUPERSEDED trigger — do not act on it` + `✅CURRENT RESUME = …`.

**Same shape as** [[feedback_shared_index_is_generated_use_shared_root]]'s self-expiring note that
does not expire itself: the condition names an event, and nobody re-checks whether the event is still
reachable.

### ⭐⭐ RECENCY OF EDIT beats any keyword probe as a defect predictor

Both of us swept for trigger-less rows; both sweeps misfired the same way (searching for the literal
label `RESUME` instead of the *substance* — the marker-count proxy error, flagging rows whose triggers
were spelled `AWAITING …`, `held-r`, `MAINTAINER-GO→fixer`). The signal that actually worked:

> **The one genuine gap was in a row that had just been edited; every false alarm was in a row nobody
> had touched.**

⇒ After index surgery, **audit what you just changed first** — and specifically ask *"is this row's
trigger still reachable?"*, not *"does this row contain the word RESUME?"* Cheap, ordered by
likelihood, and it does not depend on guessing the vocabulary.

## Split-out concepts (folded 2026-09-18 by /okf-synthesis)

The store-reachability probe measurement log that had accreted below the trigger taxonomy was split into its own concepts:

- [[feedback_a_reachability_census_must_match_name_and_control_for_disk.md]]
- [[technique_a_reachability_probe_runs_to_fixpoint_leave_one_out_and_persists.md]] (implemented as `/workspace/agent/tools/memory-closure.py`)
