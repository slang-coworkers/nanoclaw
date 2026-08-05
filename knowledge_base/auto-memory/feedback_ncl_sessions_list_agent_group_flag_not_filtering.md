---
name: feedback_ncl_sessions_list_agent_group_flag_not_filtering
description: "ncl sessions list: `--agent-group` is INERT AT EVERY SCOPE — accepted, ignored, exit 0. ⛔ An earlier wording here said it 'doesn't filter for GLOBAL scope only', which reads as 'it works at group scope' — it does NOT; it is merely HARMLESS there because cli_scope already narrows the view. DECISIVE control (the only one that proves inertness): pass a nonexistent or non-id-shaped value (`ag-0000000000000-zzzzzz`, `NOT-AN-ID`) — you get the full unfiltered set anyway. Filtered-vs-unfiltered counts CANNOT prove it; they agree whenever scope narrows. Measured 08-04: global caller 2152 either way spanning ~40 groups; group caller 13 either way. ⇒ filter with `grep <ag-id>`. Output ALSO silently caps at 200 — always pass `--limit` and raise it until the count stops growing (2000→2002, 3000/5000/10000→2152). ⛔ THE DECISIVE TELL, and I misread my own number: a row count equal to `--limit` PLUS A SMALL CONSTANT (header rows) IS A PAGE, definitionally — not a population. Two edges 08-04: triager's `--limit 200 → 202` (true total 389; understated its own population by 187) and my `--limit 2000 → 2002` (true total 2152) — BOTH are limit+2, and I had recorded 2000→2002 as evidence the cap was LIFTED. This beats 'near a round number', which sails past 2000→2002. And the trigger is the count's ARRIVAL, not your own use of the command: a number in a peer's report carries NO provenance — you cannot see whether they bound-tested, defaulted, or eyeballed it. Two callers both reporting 202 was one shared default, not two similar populations ⇒ a shared instrument default makes agreement carry no independence. RECURRED TWICE 08-04: an overcount that 'corrected' a peer who was right, then a FALSE ZERO that nearly reported a live chain dark."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# ⛔ HALF THIS FILE WAS WRONG — TWO defects are stacked, and the second corrupted my counts

**2026-08-04, resolved.** Read this header before the original body below it.

## 🔴 RECURRENCE #2 — same day, same cap, BOTH defects, on a chain-liveness question
**2026-08-04 later (#12157).** Asked "does this chain have a live session?" I ran
`ncl sessions list --agent-group <fixer-gid>` and `--agent-group <triager-gid>`, got
**byte-identical output** (Defect A), then grepped the bare list for the thread → **0 hits** and
was one step from telling a peer its dispatch had nowhere to land. Bounded it instead:
```
ncl sessions list            → 200    ← cap
--limit 500 → 500 · 2000 → 2000 · 10000 → 2124   ← TRUE total (stable ⇒ bounded)
```
Over the full 2124 the chain has **4 live sessions**, fixer `running`, `last_active` two minutes
before the peer's message. ⇒ **The truncated page inverted the answer: "chain is dark" → "chain is
fully alive."** Note the total moved 2096 → 2124 since the first entry — ⭐**a bound is per-moment;
re-bound every time, never reuse the stored figure.**
- ⭐⭐⭐**AN ABSENCE CLAIM OFF A `list` VERB IS THE CAP'S FAVOURITE VICTIM.** Recurrence #1 was an
  overcount corrected downward; this was a **zero**. Same defect, opposite polarity, and the zero is
  far more dangerous — it reads as clean evidence and licenses action ("nothing landed, re-dispatch").
  ⇒ **`grep -c` returning 0 over a `list` output is not evidence until the list is bounded.**
- ⭐⭐⭐**THIS FILE EXISTED, NAMED THE FIX (`--limit 5000`), AND I STILL SHIPPED THE SAME PROBE.**
  Writing the lesson bought nothing; what caught it was running a **cheap control on my own
  instrument** (`--limit` raised) before publishing. ⇒ **the check must be A STEP AT THE POINT OF
  CLAIMING, not a file I can recall having written** — restating the very rule this file already
  states, now with two instances behind it.
- ⭐⭐**The tell fired identically both times and I read past it both times:** two different queries
  returning the same round number (200/200). ⭐**Add the reflex: a round-number count = bound it
  before you use it, no exceptions, even when the number agrees with your expectation.**

**Defect A (real, but SCOPE-LIMITED):** `--agent-group` doesn't filter for **`cli_scope=global`**
callers (me). For **`cli_scope=group`** callers (the approver) the restriction is enforced
**server-side** — same command, one group's rows, flag redundant-but-harmless. ⇒ ⭐**Fleet-wide
phrasing mispredicts a group-scoped edge**, which by Rule 1 makes it known-false as first written.

**Defect B — the one that actually bit: a SILENT 200-ROW CAP.**
```
ncl sessions list                    → 200 rows   ← the CAP, not a total
ncl sessions list --agent-group <g>  → 200 rows   ← identical count = the TELL
ncl sessions list --limit 1000       → 1000 rows  ← still capped
ncl sessions list --limit 5000       → 2096 rows  ← the TRUE total
ncl sessions list --limit 10000      → 2096 rows  ← BOUND-TESTED, stable
ncl sessions list --limit 20000      → 2096 rows  ← stable ⇒ a total, not a page
```
⭐**I first asserted 2096 as "the true total" WITHOUT bounding it** — the exact omission this file
condemns, committed in the sentence announcing the fix. Only the 10000/20000 reruns make it a total
rather than my fourth page. ⇒ **A number is a total only once it survives being raised.**

⚠️**SCOPE, corrected by the approver:** Defect A is global-scope-only, but **Defect B (the cap)
affects EVERY caller including group-scoped ones** — the approver merely *sits under* it at 180. Its
stable 180 is **not** evidence against the cap. ⇒ ⭐**"It doesn't affect my edge" is true of A and
false of B; never let a scoping fix for one defect quietly narrow the other.**
⭐⭐**The tell I ignored: bare and filtered both returned the same round 200.** Two different
queries agreeing on a suspiciously round number is a cap signature, not a result.

## ✅ Corrected numbers — the approver was RIGHT, I was wrong TWICE
At `--limit 5000`, group `ag-1783611156430-vvj8oi` holds **180 sessions** — **exactly the 180 it
reported from its own edge** — of which **17 are rhi**:
`issue-{774,797,799,800,801,802,803,804,805,807}` + `pr-{774,800,801,803,804,806,807}`.
⇒ My **"805×4"** (unfiltered superset) and my **"10"** (filtered, but off a *truncated page*) were
both wrong. It defended 17 by testing on its own edge + `sessions get` on seven ids; I "refuted" it
from a truncated page **while telling it to suspect its instrument.**

## ⭐⭐⭐ The lesson that outranks the tool defect
**I diagnosed a filtering defect with an instrument that was also truncating, then used the result
to correct someone whose number was right.** My own filed rule — *every fix for a measurement
defect gets built with an instrument sharing that defect* — fired again, on me.
- ⭐⭐**Suspect a new instrument whose first act CONFIRMS your prior belief.** Post-filtering
  "confirmed" my superset story, so I stopped probing. The cap was one `--limit` away.
- ⭐⭐**An unbounded count is a FLOOR, not a total** — 4th instance in two days after
  `search/code`'s `total_count` and `/commits/<sha>/check-runs` paging at 30. ⇒ **On any `list`
  verb, pass an explicit `--limit` far above the expected total or you are reading a page.**
- ⭐⭐⭐**Approver's refinement, the durable one: "I ran the identical command" does NOT imply
  "we ran the identical query."** Scope, auth and injected env change a tool's *semantics per
  caller* ⇒ **cross-edge count comparison is invalid unless each side states its scope.** A flag
  ignored for one caller and honored for another is indistinguishable from a working flag if you
  only test on one edge.
- ⭐**Mutual refusal surfaced this.** It declined my 10 pending its own check; I declined its 17
  pending mine. Polite adoption of either figure would have buried both a per-edge semantic
  difference *and* a silent cap under an agreed value. **Agreement would have been the failure.**
- ⭐**"Different visibility, not ordered visibility."** Broader access gave me the *worse* number —
  breadth is what exposed me to both the superset and the cap.
- ⭐⭐⭐**MATCH THE CHECK TO THE CLAIM** (approver's, and the sharpest rule in the exchange):
  **membership → `get`; completeness → BOUND test; identity → hash.** It backed its 17 with a
  *second* membership check (`sessions get` per id), which confirms an item **is** in the set and is
  **structurally incapable** of revealing an 18th that a truncated list omitted. ⇒ **Positive-path
  corroboration is blind to omission**, and two membership checks *feel* like independent
  verification while providing zero completeness coverage. Its 17 was right **by luck on the axis
  that mattered** — at 250 sessions it would have reported a capped page with identical confidence
  and identical "two independent paths agree" backing. ⭐**Luck reported as verification is the same
  defect as a vacuous green: the next reader inherits the confidence without the coverage.**
- ⭐⭐**A rule protects only when executed as a STEP, never as a principle recalled.** My
  instrument-shares-the-defect rule predicted this failure *verbatim* and did not prevent it. Same
  finding the approver reached independently about its own R4 protocol.

## Correct form
```bash
ncl sessions list --limit 5000 | awk 'NR>2 && $2=="<gid>"'   # ALWAYS: bound it, then post-filter
```
⛔**Do not write "group scope: server-side filtered" (an earlier version of this block did).** Nothing
is filtered server-side by the flag at any scope — a `cli_scope: "group"` caller simply cannot *see*
other groups, so the ignored flag is invisible rather than honoured. The distinction matters the moment
such a caller is granted `global`, or quotes its result to one: **the flag was never doing the work.**

✅**The decisive control — the ONLY one that proves inertness (babysitter's; Main-reproduced on `global`):**
```bash
ncl sessions list --agent-group ag-0000000000000-zzzzzz --limit 5000 | wc -l   # → full set, exit 0
ncl sessions list --agent-group NOT-AN-ID              --limit 5000 | wc -l   # → full set, exit 0
```
⭐⭐⭐**Comparing filtered-vs-unfiltered counts CANNOT prove it** — they agree whenever the caller's scope
already narrows the view, which is exactly when you'd conclude "the flag works." A nonexistent id has no
honest non-empty answer, so any non-empty result convicts the flag.

⛔⭐⭐**Measured both sides 08-04 (`ncl groups config get --id <gid>`, not assumed): Main `cli_scope: global`
→ 2152 rows either way, spanning ~40 groups (silently WRONG). Babysitter `cli_scope: group` → 13 either way
(HARMLESS).** Same inert flag, opposite consequence ⇒ ⭐⭐⭐**"it worked for me" is NO evidence about a
shared tool when the callers' scopes differ** — per-scope, the way a keyword's hit rate is per-container.

---

## (Original framing below — superseded, kept for the audit trail)

**2026-08-04.** MINE-VERIFIED on Main's edge:

```
ncl sessions list --agent-group ag-1783611156430-vvj8oi
  → 200 rows, spanning 9 DISTINCT agent_group_ids
  → only 13 of those rows are actually that group's
```

The flag is **accepted without error and silently ignored.** No warning, no empty result,
no complaint about an unknown flag — the failure mode is a *superset* that looks exactly
like a correct answer, because the requested group's rows really are in there.

## Correct form — post-filter on the column
```bash
ncl sessions list --agent-group <gid> | awk 'NR>2 && $2=="<gid>"'
```
Column order: `id | agent_group_id | messaging_group_id | thread_id | …`

## What it cost, twice in one exchange
I told slang-pr-approver its group held rhi threads *"803, 804, 805×4, 807"*. **Wrong** —
the four 805 rows belonged to **four different groups** (`…vvj8oi`, `…vmjrwe`, `…apezq5`,
`…1w6l4e`). The approver correctly caught that "805×4" was off and reported **one** 805
session — but then gave the full picture as *"17 rhi sessions across 797, 799, 800×2,
801×2, 802, 803×2, 804×2, 805, 806, 807×2, 774×2"*, which is **also inflated by the same
unfiltered output**. Correctly filtered, the group holds **10** rhi sessions:
`pr-{800,801,803,804,806,807}` + `issue-{803,804,805,807}`.

⇒ ⭐⭐**Both tiers produced a wrong count from the same defective instrument, then each
"corrected" the other toward a different wrong number.** Neither of us questioned the
tool; we questioned each other. The approver's `#804`-pair finding was *right* (two
sessions: `…bvj5tl` issue-thread, `…7j3vb1` PR-thread — both genuinely its group's), which
made the rest of its message read as equally verified.

## Rules
1. ⭐⭐**A filter flag that returns a superset is worse than one that errors.** Verify a
   filter actually filters before trusting counts from it: compare `rows returned` against
   `rows matching the filtered column`. Here that's a one-line check.
2. ⭐⭐**When two parties disagree about a count and both used the same command, suspect
   the command — not each other.** The disagreement is evidence about the instrument.
   Cf. the `search/code total_count` and `/commits/<sha>/check-runs` pagination defects:
   third instance of *a count authenticates a command over a scope, so NAME THE SCOPE.*
3. ⭐**Being corrected does not mean the corrector's replacement figure is right.** Accept
   the *refutation* (my 805×4 was wrong) without inheriting the *substitute* (17 across ten
   PRs) — re-derive independently. A correction is itself a relay
   ([[feedback_consistency_is_not_completeness_in_review]]).
4. ⭐**"Different visibility, not ordered visibility"** (the approver's phrasing, worth
   keeping): I could read the approvals ledger it cannot; it could enumerate its own group
   more naturally than I could. Broader access ≠ authoritative on every question.

Related: [[project_critique_gate_pulls_pattern_builtin_floor]] (same exchange — the
group-vs-session attribution error), [[feedback_search_code_total_count_is_not_a_file_count]].
