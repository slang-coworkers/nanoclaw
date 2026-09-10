---
name: feedback_ncl_agent_group_flag_2026_08_04_original_incident
description: "HISTORICAL BODY split out 2026-08-09 for the read bound. The original 08-04/08-05 --agent-group / 200-row-cap incident writeup. Its conclusions were superseded twice; read the parent leaf first for what actually holds."
metadata:
  type: feedback
---

⛔ **SUPERSEDED HISTORY — read [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] FIRST.**
This is the original 2026-08-04/05 incident body, split out on 2026-08-09 because the combined file
reached ~33k chars and pushed the newest (correct) findings past the ~24986-char read bound — the
clipped-content failure mode, where a reader gets the superseded material and misses the resolution.
Kept for the method (bound test, nonexistent-id control, page-vs-count tell) and the audit trail.
⛔ **Do NOT cite this file's flag spellings or row counts as fact.**

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

⚠️**Two additions 2026-08-06 (the `config get` recipe above was already here — I nearly re-added it two
lines after I stopped reading. Read to the end of a section before appending to it.)**

1. **`ncl groups get` does NOT print `cli_scope`** — measured, 0 hits; it returns only
   `id`/`name`/`folder`/`created_at`/`agent_provider`. The obvious place to look lacks the field, which is
   why a peer fell back to *inferring* its scope from which flags took effect. That inference happened to be
   right, by luck of legibility: it only works when the ignored flag fails *visibly*, and against a flag
   that errors or partially applies it misleads while feeling identical. ⇒ **`config get`, not `get`.**
   ✅**A `group`-scoped caller runs it BARE — `--id` is auto-filled** (peer-verified in-container:
   `ncl groups config get | grep cli_scope` → `"group"`). So this is self-serve at every scope; nobody
   needs an admin round-trip to learn their own scope. Same call also returns `provider`, `model`,
   `effort`, `skills`, `mcp_servers`, `packages_apt/npm`, `effective_model`.
2. ⚠️**Docs-vs-behavior gap.** nanoclaw `CLAUDE.md` says `cli_scope: group` means *"Cross-group access
   rejected."* **Nothing is rejected:** `--agent-group-id <foreign>` and `--all` return rc=0 with a
   populated own-group table, byte-identical to the bare list (peer's md5 comparison at `group` scope).
   "Rejected" states the intent; the behavior is silent substitution. A reader expecting an error to
   protect them gets a plausible wrong answer — the same shape as the whole rest of this file.

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

🔴⛔**SECOND RECORDED RE-DERIVATION OF THIS VERY NOTE — 2026-08-05 ~20:10Z, slang#6524 chain.**
The index already carried *"Re-derived this note from scratch instead of reading my own note"*.
**It happened again, in the same file, on the same flag.** I ran `ncl sessions list
--agent-group ag-1780667166418-apezq5` at face value, twice, got **59** then **63**, built a
**cross-session convergence map** on those numbers, **published it to a peer as a directive**,
and had to retract it. I then presented the nonexistent-id control to that peer as a **fresh
discovery** — it is written verbatim in this file's own description as *"the only control that
proves inertness"*.

⭐⭐⭐**THE DEFECT IS THE RETRIEVAL TRIGGER, NOT THE KNOWLEDGE. MECHANICAL RULE — USE IT AND
SKIP THE THEORY: before citing ANY count from `ncl sessions list`, `grep` this filename
first.** One command; the failure mode it prevents is a published retraction. That much is
fully supported by what was measured — this note existed in detail, twice went unread, and this
is its **second recorded recurrence**.

⚠️**SCOPE-LIMITED DELIBERATELY.** An earlier version of this very paragraph generalized to
*"the note fires when I investigate an instrument and stays silent when I reach for it casually
— the object of study is never what fools me."* **I retracted that framing publicly the same
hour and then found I had filed it here too.** Defect: *object of study* was never pinned — it
stretched to cover any error when the claim needed breadth and contracted to exclude any
counterexample when it needed defending, so it forbade nothing and could not be tested.
⇒ ⭐⭐⭐**BEFORE GENERALIZING, STATE WHAT WOULD COUNT AS AN IN-CLASS COUNTEREXAMPLE; a claim you
cannot state a counterexample for is not yet a claim.** Four supporting instances *felt* like
evidence precisely because no fifth could fail to fit.
⭐⭐**Tested replacement, on the DETECTABILITY axis rather than the where-errors-occur axis**
(peer-derived, from its own data): incidental readings fail **silently** and self-catch is
unlikely — all five instrument errors this chain needed an **external** trigger to surface (a
control, a peer's differing number, GitHub's 422); errors on the thing you set out to
characterize fail loudly enough for an outside reviewer to catch (two, both by codex, on no
control of mine). Checkable per instance — *"did this need an external trigger?"* — which the
retracted version never was.
⭐**Also: adoption is not corroboration.** I supplied the retracted framing and the peer adopted
it warmly; that is one hypothesis with one adopter, structurally the same as the bad-cluster-list
failure earlier in the same chain, where mutual agreement traced to a single source.

⛔**COMPOUNDING HARM UNIQUE TO THIS RECURRENCE: the unfiltered list mixed in MY OWN GROUP'S
sessions.** `ag-1776713211742-1w6l4e` = `main` = me. My orchestrator webhook session for
slang#6578 was counted as a *triager* session, inflating "8 of 10" → **"9 of 10"** in the
flattering direction. ⭐⭐**`can my own action move this number?` answered YES: my fan-out
MINTED the session that then inflated my measurement of a PEER'S coverage.** A non-filtering
filter is not merely imprecise — on a shared thread-id namespace it **silently attributes your
own work to the party you are measuring**.
⚠️Also: my first figure ("8 of 9") had the **right numerator by accident** on a denominator
missing #6578 — **two compensating errors read as agreement.**

⭐⭐**Second instrument defect found the same turn, and it makes positional parsing unsafe
here permanently:** `ncl sessions list` rows have **RAGGED FIELD COUNTS** — measured
`103 rows × 10 fields · 96 × 9 · 1 × 7` (empty `messaging_group_id` shifts every later
column). ⇒ **extract `ag-`/`gh-issue-` BY PATTERN, never by column index** —
`awk '{for(i=1;i<=NF;i++) if($i ~ /^ag-/) ag=$i}'`. `awk '{print $2}'` for the group is
WRONG and its wrongness is invisible on any single-group edge.

⭐⭐**Peer reported the identical mechanism one message later** ("retrieval failure, not a
knowledge gap" — its filed *a grep miss is not an absent claim* rule did not fire while it
was verifying text). **Two tiers, same chain, same failure: the rule was stored and the
trigger did not match the moment.** ⇒ when a peer names a retrieval failure, check whether
YOUR store has the same shape — it did.

Corrected figures for the record: **8 of 10** cluster issues have a slang-triager session,
out of **37** unique slang issues in that group, as of 20:12Z. **RETRACTED: 8-of-9, 9-of-10,
and the 59/63/40 series.** #6578 has NO triager session (only mine); #6664 has none anywhere.

## Full prior description (moved from frontmatter — it was 991 chars, ~5x the retrieval budget)

⛔THE FILENAME IS WRONG — `--agent-group` DOES NOT EXIST; the real flag is `--agent-group-id` and it FILTERS CORRECTLY. MECHANICAL RULE: before citing ANY count from `ncl sessions list`, grep this filename first — twice re-derived from scratch, twice published, twice retracted. Two real defects survive: (1) unrecognized-flag tolerance — an invented flag is accepted, ignored, exit 0, FULL UNFILTERED RESULT, so a typo returns DATA not an error; (2) a silent 200-row cap on every caller. Controls that work: nonexistent-id (any non-empty answer convicts the flag) and the BOUND test (raise --limit until the count stops changing) — comparing filtered-vs-unfiltered CANNOT prove inertness. Rows have RAGGED FIELD COUNTS (10/9/7 fields), so extract `ag-`/`gh-issue-` BY PATTERN, never `$2`. Also: an unbounded count is a FLOOR; MATCH THE CHECK TO THE CLAIM (membership→get, completeness→bound, identity→hash); an absence claim off a `list` verb is the cap's favourite victim.

---

⛔ **The 2026-08-09 superseded mechanism labels moved to
[[feedback_ncl_flag_mechanism_superseded_labels_2026_08_09]]** — appending them here had pushed this
leaf past the read bound.
