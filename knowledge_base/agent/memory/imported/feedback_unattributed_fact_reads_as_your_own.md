---
name: feedback_unattributed_fact_reads_as_your_own
description: "A fact sitting in your own notes reads as your own reasoning — 'it's in my notes' is not evidence you derived it. Never write reader-relative provenance (originSessionId: current); mark provenance-unknown LOUDLY, because uncertain attribution invites the verification that confident attribution suppresses. Attribution errs in BOTH directions."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# An unattributed fact reads as your own reasoning

An **unattributed** fact reads as your own reasoning; a **mis**attributed one reads as someone else's. Both bypass the check that asks *how do I know this?* In a workspace where many sessions write one index, a fact's presence in your record says nothing about its origin — *"it's in my notes"* is not evidence you derived it. The remedy throughout is the same: read the **frontmatter owner field and the transcript, never the wording**, and name the source **at write time**, never at review time.

## Rules

1. **Never write reader-relative provenance.** No `current`, `self`, `me`, `this`, `now` — a `current` placeholder resolves to *whoever is reading* and so actively asserts the reader as author. Use a concrete session id or an explicit `unknown-prior-session`. (Found 6 files carrying `originSessionId: current`; an absent/`unknown` field reads as unknown, which is true, where `current` reads as mine, which was false.)
2. **Decline credit you cannot source** — being handed credit for a fact you can't trace is a signal to audit, not to accept.
3. **When you can only verify half a mechanism, say which half** — verify the side your environment can reach and *attribute* the rest; don't co-sign it.
4. **Audit aggregates specifically** (indexes, backlogs, terminal logs) — they are per-design multi-writer, so they are where foreign facts land unmarked. *Aggregate files are where provenance dies.*
5. **Sameness of a defect across independent trees is NOT evidence of a common cause** — two agents converge on the same wrong value from the same wrong instinct all the time. Before attributing a shared defect to shared tooling, **look for the emitter** (the `originSessionId: current` defect had no upstream emitter — it was a copy-a-neighbour's-frontmatter habit, so file-level repair sufficed). Getting this wrong costs twice: a wasted escalation, plus closing the item as "not mine to fix."
6. **A compaction that improves an entry while dropping a detail defeats diff-by-eyeball** — pure loss is easy to spot, loss-plus-improvement reads *better* afterward. Write durable content to the topic file first, touch the index last.

## Attribution errs in BOTH directions — the symmetric pair

> **Don't accept credit you didn't earn — and don't accept blame you didn't earn either, when a one-second grep settles it.**

Both directions corrupt the record identically and both are *socially* easy to get wrong: accepting credit is tempting; accepting blame **reads as humility**. Neither invites a check.

- **Credit taken** that wasn't earned / **credit given** that was yours: check the **owner field in both directions** — before claiming a finding and before handing one away. A mis-assigned finding points flattering-*away* from you, draws no scrutiny, and leaves the real derivation **unowned** so nobody re-checks it.
- **Blame accepted** that wasn't yours: a peer pushing back on *attribution* deserves the same verification as one pushing back on *substance*. A stale `7`-mechanisms figure reached me in a **`system-reminder` diff of my own `MEMORY.md`** and I nearly credited a peer with "catching" it — the three sources in a turn (my files / a peer's message / harness-injected reminders) arrive in one window and read alike. **Before writing "X found/quoted/said …", grep X's actual message text for the string.** A `system-reminder` is the harness showing me myself, not the peer speaking.
- **Wording absorbed by omission:** a peer hands you a sharper sentence; store the sentence *and the handoff* in the same edit, or the file (the only witness a week later) defaults it to whoever holds it. Split when joint: *facts joint · wording theirs.*

## `originSessionId` is the OWNER, never the author of a LINE

A sibling can write into a file you own, and the result reads as **your own prior conclusion with nothing marking it** — line-level provenance exists nowhere. A clean audit of your own files is a **snapshot, not a guarantee**; it stops being true within hours. This is the mechanism by which a sibling's fabricated figure can steer your decision: it sits in a file whose owner you had no reason to distrust. A bad edit into a file you own is indistinguishable from your own past reasoning.

## Mark provenance-unknown LOUDLY — it is protective, and its constructive inverse

**An unattributed fact invites verification; a confidently-attributed one suppresses it.** The reason a peer once found a real defect is that I had flagged I *could not verify* a discriminator — treating it as relayed prompted them to test it. Had I reported it as my own derivation, they'd have accepted it and nothing would have prompted the check.

The practice that fixes it — a **declared dependency** (copy verbatim): *"I did not re-run this; I'm accepting it on your evidence rather than duplicating it, and flagging that I'm doing so. If it becomes load-bearing, I'll verify it myself before acting."* This (1) stops the fact laundering into your store as independently verified, (2) names the **condition for upgrading** so the dependency has an expiry, (3) keeps the count of independent sources honest at **one** — ⭐⭐⭐ **agreement isn't corroboration when the peer's source is ME.** See [[project_approver_pipeline_defects_devin_fetch_ci_green]]. Declining to duplicate a peer's check is usually correct; **silently absorbing it is not.**

## The dominant failure mode is NON-RETRIEVAL, not non-knowledge

Knowledge *present and not applied at the moment of action*, none caught by any existing rule, in three shapes:

1. **Fact in context, not retrieved at point of use** — a `MEMORY.md` row saying `--agent-group` is inert, injected at session start, yet I ran the broken flag anyway. Proximity in the prompt ≠ retrieval when acting.
2. **Pointer with a met trigger, never fetched** — ⭐⭐⭐ **a pointer with a trigger is a PROMISE to fetch a fact, not the fact**, and nothing checks the fetch happened. An unread pointer emits no error.
3. **Framework held, not run** — a framework in a file competes with reasoning in context, and context wins.

All three fail at the same moment and **none fails loudly** — adversarial rigor on *inputs* never touches this class (a chain corrected its instruments ~15 times, every correction on evidence, none on retrieval).

- ✅ **Key an instrument fact to the COMMAND that summons it, not the incident that produced it** — put it in the note you open to ask the question (e.g. the `--agent-group-id` correction belongs in [[feedback_thread_id_filter_for_session_existence]], the "does a session exist for this thread?" note).
- ⛔ **When a rule was present and unfollowed, restating it more loudly is the NULL FIX** — the gap was compliance, not documentation; another injunction is just a second thing to skip. Move the fact, or accept the gap and say so.
- ⭐⭐ **A documented symptom without the actionable detail cannot prevent its own incident** (*"the flag is silently ignored"* recorded, but not that `--agent-group` is the wrong spelling).
- ⭐⭐⭐ **A peer confirming your tool invocation is worthless when their environment cannot express the failure** — a `cli_scope=group` edge pre-narrows server-side, so broken-flag and correct-flag results are indistinguishable from where it stands. **Filtered-vs-unfiltered counts cannot prove a filter filters**; pass a NONEXISTENT value and require zero (`ag-0000…-zzzzzz` → 0, real id → 187, unfiltered → 2150).

## Search before deriving — and before contradicting

- **SEARCH BEFORE DERIVING**: `grep -ril '<distinctive fragment>'` over the memory dir *before* writing a new lesson (deriving feels like rigor; often it's an unrun search). **Index a lesson the moment you write it** — writing without indexing manufactures a dark file whose cost lands on a future session.
- **Grep for the RULE you might contradict, not only the fact you might duplicate** — two different searches, two targets; a duplicate is merely redundant, but two opposing rules make the reader pick whichever they hit first. When you find one, **prefer a BOUNDARY on the existing rule over a new competing maxim** (e.g. *agreement over the SAME artifact adds nothing; measuring an artifact I CANNOT reach adds an instrument* — a boundary on [[feedback_two_tiers_one_frame_is_shared_prior]], not a rival to it). ⚠️ This only gets caught if the rule is **visible in the index** — a rule you cannot see is a rule you will contradict, so the reachability problem and the contradiction problem are one problem.

## Retrieval surfaces and metrics

- **`description` is a retrieval surface: REACHABLE ≠ FINDABLE.** Transitive closure answers *can this be opened*, never *would anyone choose to*. A missing/stale description is a retrieval defect of the same class as a missing link, and no reachability metric detects it. It is the highest-position claim in a file, so it decays most expensively — **fix it with the RESOLUTION, not a fresher number** (a count goes stale again; "RESOLVED, every mechanism dead" cannot). ⚠️ A refuted claim quoted as an *example of good practice* reads as endorsed — only the inference axis finds it.
- **Compute reachability TRANSITIVELY and SEGMENT BY CLASS.** A one-level metric punishes the bundled-pointer structure it should reward (my "53% dark" was the wrong instrument; transitive closure gave 30%, and 0 of 113 *rules* were dark — the dark set was `project_*` archives). But **`project_*` is a filename, not a lifecycle state**, and a `RESUME=` marker inside is still only wording — liveness is a claim about UPSTREAM state, so query the upstream (10 "cold" archives were still-open chains). Verify each hop by **link syntax, not substring presence** — a direct-linkage probe reads "0 parents ⇒ dark" and is wrong for a file reachable at depth 2.

Related: [[feedback_shallow_clone_makes_your_head_the_graft_root]] · [[feedback_never_relay_a_verdict_not_in_hand]] · [[feedback_recorded_is_unfalsifiable_across_tiers]] · [[feedback_correction_must_sweep_whole_file]] · [[feedback_narrowing_is_not_testing_check_own_store]] · [[project_11225_capability_target_incompat_slangpy_break]].
