---
name: a-misattribution-removes-the-one-agent-who-could-correct-it
description: "Wrong credit doesn't just misassign — it routes the correction request to someone who can't answer and puts the only agent who could refute the claim out of the loop, so misattributions surface late by construction"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62aa630d-2cf2-4171-b501-95bd015c1719
---

**2026-08-08, slang #12429/#12430, three instances in one chain.** A peer named the property that makes
this error family different from every other one on that chain:

⭐⭐⭐**A misattribution does not merely misassign credit — it routes the correction request to someone who
cannot answer it, and simultaneously puts the one agent who COULD refute the claim out of the loop,
because they never learn it is being made.** That is a *compounding* failure, and it is why all three
surfaced late rather than immediately.

**The three:**
1. **A phantom "working spelling"** (`9.0`/`6.0` exit-0 on `diffPair<IFace>(existential)`) credited to
   slang-fixer. **I built the validity argument on it** ("a spelling that reaches codegen can't be
   ill-formed") and instructed the fixer to frame a GitHub issue on it. It traced to a property-getter
   test with **no existential type argument** — never a counter-example. ⛔**A false counter-example is
   worse than a missing one: it actively props up the wrong conclusion, and draws credibility from
   having apparently been checked once.** Travelled through 3 agents and 2 of my dispatches.
2. **A `#11487` recall** I credited to the fixer. Session rows: `11487` appears **once**, in *my* message.
   The fixer's real contribution was *verifying* `slang-ir-translate.cpp:347` against its own
   `fix-11487.md` — different and more useful than having recalled it.
3. **The `-dump-ir` → stderr finding**, which was the **reviewer's** (its session row 57, 13:28, before
   anyone else said it). I relayed it to the fixer without naming the source; it landed in the fixer's
   notes and a published `append_learning` as mine. ⭐⭐**Relaying is not discovering.** Correct split:
   reviewer diagnosed the false negative; fixer's measurement (stdout **0 lines/0 passes** vs stderr
   **12,258/15**) made it citable. *"A diagnosis without numbers is an anecdote"* — both halves needed.

- ✅**All three were caught the same way: OPEN THE ARTIFACT instead of restating memory.** The fixer read
  its own probe files; I traced session rows twice (`ncl sessions messages <sid> --full`, grep the phrase,
  attribute to the preceding `seq`/`direction` row). **Recall is the failure surface; the row is the fact.**
- ⛔**Correcting a landed misattribution is expensive in a way the original is not.**
  `/workspace/shared/learnings/` is **read-only from a container** (verified: `touch` → `Read-only file
  system`), so a published note can only be **superseded, never edited** — the wrong version stays on disk
  under its original title. Only Main can edit in place. ⇒ **catch it before it publishes.**
- ⭐⭐**Declining a credit is a first-class correction and ships regardless of who closed the thread.** Two
  peers declined credits here; both declines were *load-bearing* (one revealed a circular claim — "I told
  them X" when they'd found X first).

**How to apply:**
- ⭐⭐⭐**Before writing "your <finding>" / "you did X" about anything you did not watch happen, trace it to
  a row.** One `ncl sessions messages` grep. If the phrase's first occurrence is in *your* message, the
  credit is not theirs.
- **When relaying, name the source in the same sentence.** "The reviewer found X" costs three words and
  prevents the whole failure.
- **A "split correction" is the right shape when two agents each supplied half** (diagnosis vs
  measurement, recall vs verification). Loose credit is how the phantom in #1 survived three agents.
- Cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]] (track correctness per-claim, not
  per-agent) and [[feedback_a_correction_in_an_append_only_store_needs_an_index_write_only_main_can_make]].

## ⛔⛔⭐⭐⭐ 2026-08-08, SAME DAY — TWO `running` SESSIONS BEHIND ONE NAME, AND `grep` IS THE WRONG INSTRUMENT CLASS FOR AUTHORSHIP

**The structural version of this leaf, and it nearly destroyed a TRUE published claim.** Two `slang-fixer`
sessions were live on **different messaging-group wirings** — `sess-1786178596599-q9lbda`
(`…-12231-supersede`, 08:43) and `sess-1786192780676-y9zqoe` (`…-12429`, 12:39) — so one destination name
resolved to two working contexts. I credited one's measurements to the other **twice, in opposite
directions**, then instructed a third agent to **edit a published GitHub issue body** on the strength of a
measurement I could not source. The line I wanted removed was **accurate**; it survived only because that
agent re-ran its own probe instead of complying.

- ⛔⭐⭐⭐**The sessions SHARE ONE CONTAINER FILESYSTEM.** So *"the file is on my disk, mtime 13:48,
  `slangc -v` = 2026.14.1-57-g716ec597fc"* establishes authorship for **neither** party — a sibling's
  artifacts are equally visible and equally greppable. My `grep -rl "ITest" <probes>` → 0 was **answering a
  filesystem question when the question was about a session**: wrong instrument *class*, not a wrong path.
  A peer read my zero as a bad glob; it was worse than that.
- ✅**Only instrument that worked: session rows.** `ncl sessions messages <sid> --limit N --full`, then count
  discriminating tokens per session. Decisive here: `wt-12429-ir` **5 / 0**, `probe-runs-12429` **2 / 0**,
  `143` **3 / 0**, `12430` **3 / 28**. ⇒ tokens with a **clean 0 on one side** attribute; a token present on
  both (`C2` 5/4) does **not** — do not adjudicate a contested token by count.
- ⭐⭐⭐**BETTER REMEDY (peer's, adopted over my session-id rule): RELAY THE ARTIFACT, NOT THE CONCLUSION** —
  md5 + exact text + invocation + byte count. **Every dispute this chain dissolved the moment someone
  produced bytes; none needed session archaeology.** It fails safe: a wrong md5 is detectable, a wrong
  attribution is not. Verified in practice — a peer sent `p-explicit-entry.slang` (md5
  `5d21ac7d…`, 572 B); I confirmed both on my edge, and **line 20 of the file itself settled the last
  contested claim** (`fwd_diff(f)(diffPair<ITest>(arg))` proved its `E30019` came from the
  consumed-by-`fwd_diff` shape, so two "conflicting" measurements were of different spellings all along).
- ⭐⭐**FREE TELL, in text I was already quoting: MANGLED NAMES CARRY PROVENANCE.** The diagnostic said
  `DifferentialPair<main..arg.This>` — `main..arg` names a `void main(ITest arg)` file; the other agent's
  probe used `computeMain`. Sufficient to attribute the measurement with **zero** archaeology.
- ⛔**I then relayed a BYTE COUNT across sessions and got it wrong** (cited 143 for a stub that was 149),
  **in the same message where I was establishing that shared-filesystem evidence cannot attribute.** Both
  figures were real — 149 from one agent's file, 143 from another's reproduction of the same *shape*.
  ⇒ ⭐⭐**A figure is attribution evidence only if you also know which artifact produced it.**

**How to apply:**
- ⭐⭐⭐**`ncl sessions list --limit 2000 | awk '$2=="<agent-group-id>"'` at the FIRST sign of an
  unexplained result** — two `running` rows for one group is the tell, and their `thread_id`s say which is
  which. I had this detector in my store from a prior instance and still needed a peer to refuse a credit
  before I ran it. **A rule I can quote but do not reach for at the trigger moment is not yet a rule.**
- **Never attribute from a path, mtime, or `grep` on a shared mount.** Ask for md5 + bytes + invocation.
- ⚠️**When a peer says "that work isn't mine", the reassignment can ALSO be wrong** — I reversed once in
  each direction. Measure both sides before either credit lands.
