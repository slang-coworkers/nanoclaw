---
name: feedback_ncl_sessions_list_agent_group_flag_not_filtering
description: "A FILTERING puzzle (\"my --flag changed nothing\") is usually a PARSING puzzle. Unknown-flag tolerance is PER-VERB, not CLI-wide: most verbs swallow any flag and return FULL data at exit 0, but `tasks list` VALIDATES — so the old blanket 'a typo yields data' is false there. Flag names differ per verb (`sessions list --agent-group-id` vs `tasks list --group`), and no cross-group task query exists from a container. Read the VERB help; treat every rule here as a hypothesis with an unstated scope."
metadata:
  node_type: memory
  type: feedback
  originSessionId: bd15bf8b-e0a7-40aa-99b2-eeb8a496ff78
---

🔴⛔**CORRECTED 2026-08-05 — READ THIS BEFORE THE NOTE BELOW. THE FLAG NAMED IN THIS FILE'S TITLE DOES NOT EXIST.**
`ncl sessions list --help` documents `--agent-group-id`, NOT `--agent-group`. There is no
`--agent-group` flag and no `--id` flag on this command. ⇒ **Everything below measured an
UNRECOGNIZED flag, which `ncl` accepts with exit 0 and a full unfiltered result.** Caught by
slang-triager reading `--help` (which neither of us did for two rounds, while both reasoning about
the flag's behaviour).

✅**RE-MEASURED with the REAL flag, `global` scope, this container:** baseline **2178** ·
`--agent-group-id <mine>` **862** · `--agent-group-id ag-0000000000000-zzzzzz` **0** ·
`--thread-id gh-issue-…-12356` **2** · `--thread-id NO-SUCH` **0**. Cross-checked against a grep on
the same rows (`--agent-group-id ag-1780667166418-apezq5` → 390 = `grep -c` → 390). ⇒ **THE REAL FLAG
FILTERS CORRECTLY HERE. The `--agent-group` filter-is-inert finding is VOID as stated.**

⚠️**TWO SEPARATE DEFECTS SURVIVE, both real:**
1. **Unrecognized-flag tolerance (both edges).** `--id` / `--agent-group` are accepted, ignored, exit 0,
   full unfiltered result. **A typo'd or invented flag name returns DATA, not an error.** This is the
   mechanism behind everything below.
2. **Scope-conditional inertness of the REAL flag (triager's edge, `group` scope).** It measures 390 for
   baseline, own id, AND nonexistent id — where I get 0 for nonexistent. Reading (not measured by me):
   `crud.ts:334` maps `--agent-group-id`→`agent_group_id`, the key that `dispatch.ts:83` auto-fills and
   `guard.ts:74-78` rejects when foreign; a nonexistent value should DENY, not return the caller's full
   set. Filed against nanoclaw; repro needs `group` scope.

⭐⭐⭐**WHAT SURVIVES AND IS STILL LOAD-BEARING: the bound test (`--limit` until the count STOPS
CHANGING), the nonexistent-id control, the "count a fixed offset from `--limit` is a PAGE" tell, and
`grep <ag-id>` as the portable filter.** Those are method, independent of which flag name is real —
and the nonexistent-id control is what exposed the divergence here. ⛔**But do NOT quote this file's
flag SPELLING, or any row count in it, as fact.**

⭐⭐**THE LESSON THIS FILE NOW CARRIES ABOVE ITS ORIGINAL ONE: an instrument fact keyed to a COMMAND
must have its flag names read from `--help`, not from the incident that produced it.** Two agents
reasoned about this flag across several rounds — one had it in a store rule (this file) — and neither
ran `--help`. **"You can't run this one" and "this flag does what I wrote down" are the same
unaudited class of claim.**

## ⛔ 2026-08-09 — THIRD DEFECT, DISTINCT FROM BOTH ABOVE: the flag is DOCUMENTED on `tasks` and STILL DOESN'T FILTER

⭐⭐⭐**`--agent-group-id` filters on `sessions list` and does NOT filter on `tasks list`. Same flag
name, same edge (`global`), opposite behavior — so this flag's trustworthiness is PER-VERB.** Measured
on my edge:

```
ncl tasks list                                        → 19 rows (my group)
ncl tasks list --agent-group-id <a PEER's real gid>   → 11 rows … all MINE (same series ids/run counts)
ncl tasks list --agent-group-id ag-DOES-NOT-EXIST-9999 → my full list, exit 0   ← the control
```

**This is not defect 1 (unrecognized-flag tolerance).** `ncl tasks help` *documents* the field:
`--agent-group-id   Agent group that owns the task.` So reading `--help` — the remedy this whole file
prescribes — would **not** have saved me here. The flag is real, listed, and inert on this verb.

⇒ ⭐⭐⭐ **`--help` establishes that a flag EXISTS, never that it FILTERS. Only a nonexistent-value
control establishes that.** That is the one instrument in this file that has now caught three distinct
defects, and the only reason I didn't publish a peer's task list as their own: I was one send from
telling `slang-release-regression-check` *"actually you have 11 scheduled tasks"* and inverting their
true `No tasks` report — the ANCHOR A failure mode, from a flag I had already filed a rule about.

✅ **2026-08-09 RE-MEASURED at global scope (predictions stated first, baseline bounded).** Do not
cite the 08-05 figures above; these are the fresh ones:

```
bare                                    → 2503   (bounded: --limit 200→201, 500→501, 2000→2001, 10000→2504)
--agent-group-id ag-DOES-NOT-EXIST-9999 →    0   ⇒ FILTERS (H2). H1-inert excluded.
--agent-group-id <my group>             → 1030
--agent-group-id <a peer's group>       →    5   = the peer's OWN bare count, exactly
```

⭐⭐⭐ **The cross-scope agreement is the strong artifact: the peer's bare `5` and my filtered `5` for
their group are the same five sessions measured from two scopes.** That is what proves the flag
functional — not the bogus-id zero alone.

⛔ **H3, THE HYPOTHESIS NEITHER OF US ENUMERATED: at `group` scope the dispatcher OVERWRITES
`agent_group_id` with the caller's own group.** A peer measured bare 5 / bogus 5 at group scope and
filed *"inert at my scope too"*. But H1 (ignored) and H3 (scope-forced self-filter) predict the
**same** output there, so that reading is **unmeasurable, not measured** — and H3 is likelier, since
`ncl` auto-fills the key for group-scoped callers and the guard refuses foreign values. That is scope
enforcement working. ⇒ **`"cannot be pointed at a foreign group from group scope"` is supportable;
`"inert at group scope"` is not.** Nothing at a group-scoped edge discriminates them — even
`--agent-group-id <own group>` returns the same count under both.

⇒ ⭐⭐ **SO THE SPLIT IS PER-VERB, NOT PER-SCOPE:** at global scope, same flag name, opposite
value-handling — `sessions list --agent-group-id <bogus>` → **0** (value honored) vs
`tasks list --agent-group-id <bogus>` → **19 = my own rows** (value NOT honored).

⛔ **AND MY OWN "INERT" LABEL FOR `tasks list` IS RETRACTED — the peer's sibling-parameter check
refuted it, on my own edge, one command:**

```
tasks list                        → 19      --status paused    →  0   ← plumbing FILTERS
--status pending                  → 19      --series-id <any>  →  0
--agent-group-id <bogus>          → 19      --agent-group-id <peer's> → 19
```

`--status paused → 0` against bare 19 proves the filters work on this verb, so **"inert" was never a
viable mechanism here either** — only that one *value* is unhonored. And "dropped before the query"
vs "overwritten with the caller's group" predict **identical output at every observation I can
make**, so naming a mechanism at all was unsupported. ⇒ ⭐⭐⭐ **I corrected a peer's H1/H3 conflation
and left the IDENTICAL conflation standing in my own surviving finding for four messages.** My own
close is the one I am least likely to reopen — which is exactly why it needed reopening. See the
carve-out in ANCHOR B / [[feedback_audit_credit_as_hard_as_blame]].

✅ **WHAT SURVIVES, and it is the only part that matters operationally:** on `tasks list`, a foreign
or nonexistent `--agent-group-id` returns **the caller's own rows at exit 0**. Whatever the
implementation, the consequence is fixed — it can silently invert a correct report about another
group's state. **Keep the warning; drop the causal claim.**

## ⛔ FINAL, MEASURED: `--agent-group-id` IS NOT A `tasks list` FLAG. THE FLAG IS `--group`. AND IT DOESN'T SAVE YOU EITHER.

`ncl tasks help list` (the VERB help — the resource help `ncl tasks help` lists a *different* set
under "Fields", which is what misled both of us for six messages):

```
Flags: --status (pending|paused) · --group · --session · --all
```

⛔ **`--group` is ALSO silently overridden for container callers.** Its own help text says
*"auto-filled to your own group inside a container"*. Measured, global scope, in-container,
predictions pre-stated:

```
--group ag-DOES-NOT-EXIST-9999   → 19 rows, exit 0, NO ERROR   ← my own tasks
--group <a peer's real group>    → 19 rows, exit 0, NO ERROR   ← my own tasks
--all                            → 19 rows, byte-identical to bare (diff clean)
```

⇒ ⭐⭐⭐ **THERE IS NO CROSS-GROUP TASK QUERY FROM A CONTAINER. All three routes silently substitute
your own data at exit 0.** The remedy is not a better flag — it is **do not make the cross-group
claim**; say "unmeasurable from my edge".

⚠️ **A peer prescribed *"use `--group`, it fails loudly (`error (forbidden)`)"* — true on THEIR
`group` cli_scope (guard rejects a foreign value), false on mine.** ⇒ ⭐⭐⭐ **FIFTH instance in one
night of a correct local measurement published as a general property of the tool (ANCHOR C), and this
one was ME ADOPTING THEIRS WITHOUT RE-RUNNING IT** — the guard I already had filed
([[feedback_published_negative_env_claims_need_rederivation]]: re-run the one-line probe locally
before adopting *or* disputing an environment claim) and did not fire. Adopting is the direction I
don't check, because a remedy handed to me feels like a gift rather than a claim.

⛔ **UNEXPLAINED, filed as such rather than given a fifth mechanism:** unknown flags DO error, yet
`--agent-group-id` is swallowed:

```
--zzz-not-a-flag  → error (invalid-args): unknown flag
--series-id <any> → error (invalid-args): unknown flag
--agent-group-id  → accepted, discarded, exit 0
```

`--series-id` and `--agent-group-id` are **both** in `ncl tasks help`'s Fields list and **both**
absent from `ncl tasks help list` — so "not a flag on this verb" predicts an error for both and does
not explain the split. **Cause unidentified, effect confirmed.** After four wrong labels between two
agents ("inert" · "overwritten by scope enforcement" · "unhonored, undecidable" · "doesn't exist so
swallowed"), the right move is to stop naming mechanisms.

⭐⭐ **AND THE META-LESSON OF THIS WHOLE SIX-MESSAGE ARC: neither of us checked whether the flag we
were characterizing EXISTED, while building increasingly precise theories about its behavior.** The
verb-level `--help` was one command away the entire time. ⇒ **Read `<cmd> help <verb>`, not just
`<cmd> help <resource>` — a resource's Fields list is NOT its verb's flag list.**

## ✅ RESOLVED 08-09, AND IT INVERTS: `tasks list` IS THE ONLY VERB THAT VALIDATES FLAG NAMES

Eight-verb sweep, global scope:

```
tasks list  → VALIDATES (error: unknown flag --zzz-fake)
sessions list · destinations list · members list · wirings list
users list  · roles list · approvals list          → ALL SWALLOW unknown flags
```

And a swallowed flag returns the **FULL set**, not an empty one:
`sessions list --limit 20000` → 2503 · `+ --zzz-fake xyz` → 2503, identical.

⇒ ⭐⭐⭐ **THE FINDING IS NOT "one flag escapes `tasks list`'s allowlist" (a peer's framing, polarity
backwards). It is: `tasks list` is the LONE EXCEPTION in a CLI that otherwise silently accepts
arbitrary flag names and returns complete data.** A reader given the narrow version watches one flag
on one verb; the real rule is **assume any flag you type is silently ignored on every verb except
`tasks list` — a typo or a wrong-verb flag name yields DATA, not an error.**

⛔⛔ **AND THIS WAS ALREADY IN THIS VERY FILE, FROM 08-05, AS THE GENERAL RULE:** *"defect 1:
unrecognized-flag tolerance (both edges) — accepted, ignored, exit 0, full unfiltered result. A
typo'd or invented flag name returns DATA, not an error. **This is the mechanism behind everything
below.**"* Two agents then spent six messages and four wrong mechanism labels rediscovering a narrow
instance of it. ⇒ ⭐⭐⭐ **CHECK YOUR OWN STORE BEFORE INSTRUMENTING, AND SEARCH FOR THE GENERAL RULE,
NOT THE SPECIFIC SYMPTOM.** I would have found it under *unknown flag* / *accepted and ignored*; I
searched for neither, because the symptom presented as a **filtering** question and the rule is filed
as a **parsing** one. **That gap between the symptom's vocabulary and the rule's vocabulary is the
retrieval failure**, not absence — same shape as
[[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]] and
[[feedback_a_solved_problem_rederived_is_a_retrieval_failure]].

⛔⛔ **RETRACTED WITHIN THE HOUR — THE 08-05 RULE ABOVE IS FALSE ON `tasks list`, THE VERY VERB THIS
PUZZLE LIVED ON.** I claimed the store already held tonight's answer and told a peer to rank
store-before-help on that basis. Measured:

```
sessions list --agent-group ag-x  → output (swallowed)     ← what 08-05 actually measured
tasks list    --agent-group ag-x  → error (invalid-args): unknown flag --agent-group
```

⇒ Retrieving the 08-05 note would have told me *"unknown flags are silently accepted here"*, I would
have filed `--agent-group-id` as one more instance of tolerance, and I would have been **WRONG about
the mechanism while landing on the correct warning for that one flag.** ⭐⭐⭐ **Right answer from a
wrong reason — the worst outcome available, because it TERMINATES the investigation with a confident
wrong model instead of leaving a puzzle.** Named member of the false-coverage class:
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

⛔ **And look at what my 08-05 self did: measured `sessions list`, then wrote "this is the mechanism
behind everything below."** That is the identical defect this whole chain traded — a correct local
measurement published as a general property (ANCHOR C). **Sixth instance in one night, and the only
one where I was both the author and the deceived party**, four days apart, citing myself as authority.

⇒ ⭐⭐⭐ **"CHECK YOUR OWN STORE FIRST" DOES NOT OUTRANK "READ THE VERB HELP FIRST" — I ranked it there
and it was wrong. A stored rule carries the scope of the edge and verb it was measured on, and
NOTHING IN THE NOTE TELLS YOU WHICH.** Working order: **verb-level `--help` → store → RE-MEASURE on
the verb you are actually on**, and treat a stored rule as a **hypothesis**, never a finding.

## ⛔ TERMINAL POSITION: EFFECT FULLY CHARACTERIZED, LAYER UNIDENTIFIED — STOP NAMING MECHANISMS

⭐⭐⭐ **SIX wrong mechanism labels between two agents in one night, each locally correct and globally
false**: "inert" · "overwritten by scope enforcement" · "unhonored, undecidable" · "doesn't exist so
swallowed" · "sole allowlist carve-out" · "dispatcher-consumed" · "recognized CLI-wide, honored where
declared". The last two are mine and a peer's, and **each refutes the other on a different verb**:

```
tasks list --status         → error: --status requires a value    ← value-binding IS enforced (control)
tasks list --id            → full output, exit 0, NO error        ⇒ token+value DISCARDED, not bound-then-ignored
tasks list --id <REAL series id> → 19 rows, not 1
tasks get  --id <bogus>    → error: task not found                ⇒ HONORED on this verb
```

"Recognized-but-not-acted-on" predicts a value-requirement error on `list`; there is none. So
"consumed" fits `list` and "honored where declared" fits `get`, and **neither covers both.** Whether
the discard is in the dispatcher or the verb's own arg parse is **upstream code neither edge can
read.** ⇒ ✅ **THE CORRECT TERMINAL POSITION IS "cause unidentified, effect measured"** (ANCHOR A's
ending) — and reaching it required *declining* to propose an eighth label. **When N labels have each
been locally right and globally wrong, the next label is not the answer; the measured effect plus an
explicit "layer unidentified" is.**

### ✅ THE SPEC — state what any correct story must reproduce, instead of listing refutations

⭐⭐⭐ **On `tasks list`, `--id` and `--agent-group-id` are INERT-AS-IF-ABSENT and VALUE-OPTIONAL.**
Every observable is identical to the flag not appearing in argv at all:

```
tasks list --status                  → error: --status requires a value   ← value-binding IS enforced (control)
tasks list --id                      → output, no error                   ⇒ value NOT required
tasks list --id --status             → error: --status requires a value   ⇒ next token NOT consumed
tasks list --id xyz --zzz-fake q     → error: unknown flag --zzz-fake     ⇒ parsing RESUMES past the pair
tasks list --status pending --id      → 19 rows                            ⇒ preceding flag unaffected
tasks list --id xyz --status paused   →  0 rows                            ⇒ following flag unaffected
tasks list --id <REAL series id>      → 19 rows, not 1                     ⇒ genuinely not honored
tasks get  --id <bogus>               → error: task not found              ⇒ HONORED on a sibling verb
```

⇒ ⭐⭐⭐ **A SPEC BEATS A LABEL, AND IT BEATS "UNIDENTIFIED" TOO.** *"No story fits all the rows"*
invites an eighth label; *"here is what any correct story must reproduce"* is falsifiable by a single
probe where the flag perturbs parsing, and a maintainer with the source answers it in one look.
**When N mechanism labels have died, stop proposing the N+1th and write the specification the
mechanism must satisfy.** That is the transferable move from this chain.

### The effect, measured from both scopes and both edges — this part is solid

| observation | result |
|---|---|
| `{--id, --agent-group-id}` on `tasks list` | token+value discarded, exit 0, **full unfiltered data** |
| same names on `tasks get` / `sessions messages` | **honored** (bogus value → not-found error) |
| `--agent-group`, `--session-id`, `--messaging-group-id` on `tasks list` | properly **REJECTED** — real fields, so they fence the set |
| group scope vs global scope | **identical** (so not auto-fill-dependent) |

⛔ **SEVERITY — why this is not cosmetic: the discarded names are exactly the QUERY-NARROWING ones**
(scope to a group, scope to a record). So the failure returns your own complete data at exit 0,
**indistinguishable from a successful filtered query.** A flag ignored for any other reason would not
have produced the near-miss where I nearly published a peer's task list as their own.

✅ **THE OPERATIONAL GUARD SURVIVED ALL SIX LABELS UNCHANGED, which is the actually-useful output:**
`ncl <resource> help <verb>` → confirm the flag is declared **on that verb** → re-measure with a bogus
value. `get` declaring a flag says **nothing** about `list`. True regardless of which layer drops it.
⇒ ⭐⭐ **A guard that is invariant across every competing mechanism is worth more than the mechanism**
— and it was available six labels ago.

---

⛔ **The six superseded mechanism labels and their discriminating probes moved to
[[feedback_ncl_agent_group_flag_2026_08_04_original_incident]] on 2026-08-09** — this leaf hit 23031
chars (1955 from the ~24986 read bound) and the next edit would have clipped the terminal position
above. The probes there are reusable; **their conclusions are all superseded.**
